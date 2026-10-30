use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use keyring::Entry;
use reqwest::{Client, RequestBuilder, Response, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::OnceLock;
use std::time::Duration;

const KEYRING_SERVICE: &str = "com.sparta.video.ai-provider";
const MAX_PROVIDER_MESSAGE_CHARS: usize = 220;

/// Shared HTTP client so connections (TLS handshakes, DNS) are pooled across commands.
/// Per-request timeouts are applied with `RequestBuilder::timeout`.
fn http() -> Result<&'static Client, String> {
    static CLIENT: OnceLock<Client> = OnceLock::new();
    if let Some(client) = CLIENT.get() {
        return Ok(client);
    }
    let client = Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .pool_idle_timeout(Duration::from_secs(90))
        .user_agent(concat!("SpartaVideo/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|_| "No se pudo iniciar el cliente HTTP.".to_string())?;
    Ok(CLIENT.get_or_init(|| client))
}

/// Sends the request and maps transport failures to user-facing messages.
async fn send(builder: RequestBuilder, timeout: Duration, service: &str) -> Result<Response, String> {
    builder.timeout(timeout).send().await.map_err(|error| {
        if error.is_timeout() {
            format!("{service} tardó demasiado en responder.")
        } else if error.is_connect() {
            format!("No se pudo conectar con {service}. Revisa la URL y la red.")
        } else {
            format!("Falló la comunicación con {service}.")
        }
    })
}

/// Reads a JSON body, turning non-success statuses into a descriptive error even when
/// the provider answers with HTML or plain text.
async fn read_json(response: Response, service: &str) -> Result<Value, String> {
    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|_| format!("No se pudo leer la respuesta de {service}."))?;
    let body = serde_json::from_str::<Value>(&text).unwrap_or(Value::Null);
    if !status.is_success() {
        return Err(provider_error(status, &body));
    }
    if body.is_null() {
        return Err(format!("{service} devolvió una respuesta que no es JSON."));
    }
    Ok(body)
}

fn validate_profile_id(profile_id: &str) -> Result<(), String> {
    let valid = !profile_id.is_empty()
        && profile_id.len() <= 128
        && profile_id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | ':'));
    if valid {
        Ok(())
    } else {
        Err("El identificador del proveedor no es válido.".to_string())
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProviderRequest {
    profile_id: String,
    kind: String,
    base_url: String,
    api_key: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProviderModel {
    id: String,
    name: String,
    capabilities: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AudioGenerationRequest {
    profile_id: String,
    base_url: String,
    model_id: String,
    task: String,
    text: String,
    voice_id: Option<String>,
    duration_seconds: Option<f32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ElevenLabsVoice {
    id: String,
    name: String,
    category: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChatRequest {
    profile_id: String,
    kind: String,
    base_url: String,
    model_id: String,
    messages: Vec<ChatMessage>,
    project_context: String,
    mode: String,
    depth: String,
}

fn keyring_entry(profile_id: &str) -> Result<Entry, String> {
    validate_profile_id(profile_id)?;
    Entry::new(KEYRING_SERVICE, profile_id)
        .map_err(|_| "No se pudo abrir el llavero de Windows.".to_string())
}

fn api_key_for(profile_id: &str, supplied: Option<String>) -> Result<String, String> {
    if let Some(key) = supplied.filter(|key| !key.trim().is_empty()) {
        return Ok(key);
    }
    match keyring_entry(profile_id)?.get_password() {
        Ok(key) => Ok(key),
        Err(keyring::Error::NoEntry) => Ok(String::new()),
        Err(_) => Err("No se pudo leer la credencial guardada en el llavero.".to_string()),
    }
}

fn required_api_key(profile_id: &str) -> Result<String, String> {
    let key = api_key_for(profile_id, None)?;
    if key.is_empty() {
        return Err("No hay una clave guardada para este proveedor.".to_string());
    }
    Ok(key)
}

#[tauri::command]
async fn list_elevenlabs_voices(
    profile_id: String,
    base_url: String,
) -> Result<Vec<ElevenLabsVoice>, String> {
    let base = checked_url(&base_url)?;
    let key = required_api_key(&profile_id)?;
    let api_root = base.strip_suffix("/v1").unwrap_or(&base);
    let response = send(
        http()?
            .get(format!("{api_root}/v2/voices?page_size=100"))
            .header("xi-api-key", key),
        Duration::from_secs(20),
        "ElevenLabs",
    )
    .await?;
    let body = read_json(response, "ElevenLabs").await?;
    let voices = body
        .get("voices")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
        .iter()
        .filter_map(|voice| {
            Some(ElevenLabsVoice {
                id: voice.get("voice_id")?.as_str()?.to_string(),
                name: voice.get("name")?.as_str()?.to_string(),
                category: voice
                    .get("category")
                    .and_then(Value::as_str)
                    .map(str::to_string),
            })
        })
        .collect();
    Ok(voices)
}

#[tauri::command]
async fn generate_elevenlabs_audio(request: AudioGenerationRequest) -> Result<String, String> {
    if request.text.trim().is_empty() || request.text.chars().count() > 10_000 {
        return Err("Escribe un texto o una descripción de hasta 10 000 caracteres.".to_string());
    }
    if !matches!(request.task.as_str(), "voice" | "audio") {
        return Err("La tarea de audio no está admitida.".to_string());
    }
    if request.task == "voice"
        && request
            .voice_id
            .as_deref()
            .unwrap_or_default()
            .trim()
            .is_empty()
    {
        return Err("Selecciona una voz para generar la narración.".to_string());
    }
    if request.task == "audio"
        && request
            .duration_seconds
            .is_some_and(|duration| !(0.5..=30.0).contains(&duration))
    {
        return Err("La duración del efecto debe estar entre 0,5 y 30 segundos.".to_string());
    }
    let is_sound_model = matches!(
        request.model_id.as_str(),
        "eleven_text_to_sound_v2" | "eleven_text_to_sound_v3"
    );
    if (request.task == "audio") != is_sound_model {
        return Err("El modelo seleccionado no corresponde a la tarea de audio.".to_string());
    }
    let base = checked_url(&request.base_url)?;
    let key = required_api_key(&request.profile_id)?;
    let mut url = if request.task == "voice" {
        let mut url = reqwest::Url::parse(&format!("{base}/text-to-speech"))
            .map_err(|_| "La URL de generación no es válida.".to_string())?;
        url.path_segments_mut()
            .map_err(|_| "La URL del proveedor no admite esta ruta.".to_string())?
            .push(request.voice_id.as_deref().unwrap_or_default());
        url
    } else {
        reqwest::Url::parse(&format!("{base}/sound-generation"))
            .map_err(|_| "La URL de generación no es válida.".to_string())?
    };
    url.query_pairs_mut()
        .append_pair("output_format", "mp3_44100_128");
    let mut payload = serde_json::json!({ "text": request.text, "model_id": request.model_id });
    if request.task == "audio" {
        if let Some(duration) = request.duration_seconds {
            payload["duration_seconds"] = serde_json::json!(duration);
        }
    }
    let response = send(
        http()?.post(url).header("xi-api-key", key).json(&payload),
        Duration::from_secs(90),
        "ElevenLabs",
    )
    .await?;
    let status = response.status();
    if !status.is_success() {
        let text = response.text().await.unwrap_or_default();
        let body = serde_json::from_str::<Value>(&text).unwrap_or(Value::Null);
        return Err(provider_error(status, &body));
    }
    let bytes = response
        .bytes()
        .await
        .map_err(|_| "No se pudo leer el audio generado.".to_string())?;
    if bytes.is_empty() || bytes.len() > 25 * 1024 * 1024 {
        return Err("El audio está vacío o supera el límite de 25 MB.".to_string());
    }
    Ok(BASE64.encode(bytes))
}

#[tauri::command]
async fn chat_with_provider(request: ChatRequest) -> Result<String, String> {
    if !matches!(
        request.kind.as_str(),
        "openai"
            | "anthropic"
            | "gemini"
            | "compatible"
            | "groq"
            | "deepseek"
            | "openrouter"
            | "mistral"
    ) {
        return Err("Este proveedor todavía no admite chat de texto.".to_string());
    }
    if request.model_id.trim().is_empty()
        || !matches!(request.mode.as_str(), "create" | "edit")
        || !matches!(request.depth.as_str(), "concise" | "balanced" | "deep")
        || request.messages.is_empty()
        || request.messages.len() > 40
        || request.messages.iter().any(|message| {
            !matches!(message.role.as_str(), "user" | "assistant")
                || message.content.trim().is_empty()
                || message.content.chars().count() > 20_000
        })
    {
        return Err(
            "La solicitud de chat no es válida o supera el límite de contexto.".to_string(),
        );
    }
    let total_chars: usize = request
        .messages
        .iter()
        .map(|message| message.content.chars().count())
        .sum();
    if total_chars > 80_000 || request.project_context.chars().count() > 20_000 {
        return Err(
            "El contexto es demasiado grande. Inicia un chat nuevo o reduce el texto.".to_string(),
        );
    }

    let base = checked_url(&request.base_url)?;
    let api_key = api_key_for(&request.profile_id, None)?;
    if request.kind != "compatible" && api_key.is_empty() {
        return Err("No hay una clave guardada para este proveedor.".to_string());
    }
    let mode_instruction = if request.mode == "create" {
        "Ayuda a planear un video nuevo con ideas concretas para guion, escenas y recursos. Si te piden estructurar subtítulos o titulares iniciales en la secuencia, incluye al final un bloque ```json con formato { \"title\": \"...\", \"summary\": \"...\", \"operations\": [ { \"type\": \"generate_subtitles\", \"presetId\": \"hormozi-karaoke\", \"entries\": [ { \"text\": \"...\", \"start\": 0, \"duration\": 2.5 } ] } ] }."
    } else {
        "Ayuda a analizar y mejorar la edición actual con propuestas concretas. Cuando propongas cambios aplicables en la línea de tiempo (cortes, audio, marcadores, o insertar títulos y subtítulos animados estilo CapCut Pro con presets 'hormozi-karaoke', 'capcut-pop-pill', 'cine-sub-minimal', 'editorial-hook', 'kinetic-neon-glow', 'lower-third-studio', 'typewriter-docu', 'bounce-viral'), incluye al final un bloque ```json con formato: { \"title\": \"...\", \"summary\": \"...\", \"operations\": [ { \"type\": \"add_text_clip\", \"text\": \"...\", \"start\": 0, \"duration\": 3, \"presetId\": \"hormozi-karaoke\" }, { \"type\": \"generate_subtitles\", \"presetId\": \"hormozi-karaoke\", \"entries\": [ { \"text\": \"...\", \"start\": 0, \"duration\": 2.5 } ] }, { \"type\": \"add_marker\", \"time\": 0, \"label\": \"...\" }, { \"type\": \"set_clip_volume\", \"clipId\": \"c1\", \"volume\": 80 }, { \"type\": \"set_clip_fades\", \"clipId\": \"c1\", \"fadeIn\": 0.4, \"fadeOut\": 0.4 }, { \"type\": \"split_clip\", \"clipId\": \"c1\", \"time\": 5 }, { \"type\": \"move_clip\", \"clipId\": \"c1\", \"start\": 0, \"duration\": 4 }, { \"type\": \"set_clip_transform\", \"clipId\": \"c1\", \"scaleX\": 110, \"scaleY\": 110 }, { \"type\": \"pack_clips\" }, { \"type\": \"set_sequence\", \"width\": 1080, \"height\": 1920, \"frameRate\": 30 } ] } usando los IDs reales del contexto."
    };
    let depth_instruction = match request.depth.as_str() {
        "concise" => "Responde de forma breve y directa, priorizando la acción más útil.",
        "deep" => "Haz un análisis cuidadoso: comprueba supuestos, señala riesgos y termina con una recomendación concreta. Expón solo una explicación breve, no razonamiento interno privado.",
        _ => "Da una respuesta equilibrada, con los pasos y detalles necesarios. No reveles razonamiento interno privado.",
    };
    let system = format!(
        "Eres Sparta AI, asistente de edición de video. Responde en español salvo que la persona escriba en inglés. {mode_instruction} {depth_instruction}\n\nContexto del proyecto seleccionado para esta solicitud:\n{}",
        request.project_context
    );
    let messages: Vec<Value> = request
        .messages
        .iter()
        .map(|message| serde_json::json!({"role": message.role, "content": message.content}))
        .collect();

    let (url, body, auth_header) = match request.kind.as_str() {
        "anthropic" => (
            format!("{base}/messages"),
            serde_json::json!({"model": request.model_id, "max_tokens": 2048, "system": system, "messages": messages}),
            "anthropic",
        ),
        "gemini" => {
            let mut url = reqwest::Url::parse(&format!("{base}/models"))
                .map_err(|_| "La URL base no es válida.".to_string())?;
            url.path_segments_mut()
                .map_err(|_| "La URL del proveedor no admite esta ruta.".to_string())?
                .push(&request.model_id)
                .push("generateContent");
            let contents: Vec<Value> = request.messages.iter().map(|message| {
                serde_json::json!({"role": if message.role == "assistant" { "model" } else { "user" }, "parts": [{"text": message.content}]})
            }).collect();
            (
                url.to_string(),
                serde_json::json!({"systemInstruction": {"parts": [{"text": system}]}, "contents": contents, "generationConfig": {"maxOutputTokens": 2048}}),
                "gemini",
            )
        }
        _ => {
            let url = reqwest::Url::parse(&format!("{base}/chat/completions"))
                .map_err(|_| "La URL base no es válida.".to_string())?;
            let mut chat_messages = vec![serde_json::json!({"role": "system", "content": system})];
            chat_messages.extend(messages);
            let reasoning_model = request.kind == "openai"
                && (request.model_id.starts_with("o1")
                    || request.model_id.starts_with("o3")
                    || request.model_id.starts_with("o4")
                    || request.model_id.starts_with("gpt-5"));
            let mut body = serde_json::json!({"model": request.model_id, "messages": chat_messages, "temperature": 0.6, "max_tokens": 2048});
            if reasoning_model {
                if let Some(object) = body.as_object_mut() {
                    object.remove("temperature");
                    object.remove("max_tokens");
                }
                body["max_completion_tokens"] = serde_json::json!(2048);
                body["reasoning_effort"] = serde_json::json!(match request.depth.as_str() {
                    "concise" => "low",
                    "deep" => "high",
                    _ => "medium",
                });
            }
            let is_lm_studio_local = request.kind == "compatible"
                && reqwest::Url::parse(&base).ok().is_some_and(|url| {
                    matches!(url.host_str(), Some("localhost" | "127.0.0.1"))
                        && url.port() == Some(1234)
                });
            if is_lm_studio_local {
                // LM Studio's OpenAI-compatible endpoint supports this hint; it prevents
                // local reasoning models from consuming the whole reply budget internally.
                body["reasoning_effort"] = serde_json::json!("none");
            }
            (url.to_string(), body, "bearer")
        }
    };
    let mut builder = http()?.post(url).json(&body);
    match auth_header {
        "bearer" if !api_key.is_empty() => builder = builder.bearer_auth(api_key),
        "anthropic" => {
            builder = builder
                .header("x-api-key", api_key)
                .header("anthropic-version", "2023-06-01")
        }
        // Header auth keeps the key out of URLs, logs and error messages.
        "gemini" if !api_key.is_empty() => builder = builder.header("x-goog-api-key", api_key),
        _ => {}
    }
    let response = send(builder, Duration::from_secs(120), "El proveedor de IA").await?;
    let payload = read_json(response, "El proveedor de IA").await?;
    if let Some(reason) = blocked_reason(&request.kind, &payload) {
        return Err(reason);
    }
    let text = match request.kind.as_str() {
        "anthropic" => payload
            .get("content")
            .and_then(Value::as_array)
            .map(|parts| {
                parts
                    .iter()
                    .filter_map(|part| part.get("text").and_then(Value::as_str))
                    .collect::<Vec<_>>()
                    .join("")
            }),
        "gemini" => payload
            .get("candidates")
            .and_then(Value::as_array)
            .and_then(|items| items.first())
            .and_then(|item| item.get("content"))
            .and_then(|content| content.get("parts"))
            .and_then(Value::as_array)
            .map(|parts| {
                parts
                    .iter()
                    .filter_map(|part| part.get("text").and_then(Value::as_str))
                    .collect::<Vec<_>>()
                    .join("")
            }),
        _ => payload
            .get("choices")
            .and_then(Value::as_array)
            .and_then(|items| items.first())
            .and_then(|item| item.get("message"))
            .and_then(|message| message.get("content"))
            .and_then(Value::as_str)
            .map(str::to_string),
    };
    text.filter(|text| !text.trim().is_empty())
        .map(|text| text.trim().to_string())
        .ok_or_else(|| {
            "El proveedor no devolvió texto. Revisa el modelo y los permisos de la cuenta."
                .to_string()
        })
}

fn checked_url(base_url: &str) -> Result<String, String> {
    let parsed = reqwest::Url::parse(base_url.trim())
        .map_err(|_| "La URL base no es válida.".to_string())?;
    if !matches!(parsed.scheme(), "https" | "http")
        || parsed.host_str().is_none()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
        || parsed.query().is_some()
        || parsed.fragment().is_some()
    {
        return Err(
            "La URL debe usar HTTP o HTTPS, sin credenciales, parámetros ni fragmentos.".to_string(),
        );
    }
    Ok(base_url.trim().trim_end_matches('/').to_string())
}

/// Detects responses that are HTTP 200 but carry no text because of safety filters or limits.
fn blocked_reason(kind: &str, payload: &Value) -> Option<String> {
    let reason = match kind {
        "gemini" => payload
            .pointer("/promptFeedback/blockReason")
            .or_else(|| payload.pointer("/candidates/0/finishReason"))
            .and_then(Value::as_str)
            .filter(|reason| matches!(*reason, "SAFETY" | "BLOCKLIST" | "PROHIBITED_CONTENT" | "OTHER" | "RECITATION")),
        "anthropic" => payload
            .get("stop_reason")
            .and_then(Value::as_str)
            .filter(|reason| *reason == "refusal"),
        _ => payload
            .pointer("/choices/0/finish_reason")
            .and_then(Value::as_str)
            .filter(|reason| *reason == "content_filter"),
    }?;
    Some(format!(
        "El proveedor bloqueó la respuesta por sus políticas de contenido ({reason}). Reformula la solicitud."
    ))
}

#[tauri::command]
async fn list_provider_models(request: ProviderRequest) -> Result<Vec<ProviderModel>, String> {
    let base = checked_url(&request.base_url)?;
    let api_key = api_key_for(&request.profile_id, request.api_key)?;
    let client = http()?;

    let mut builder = match request.kind.as_str() {
        "openai" | "compatible" | "groq" | "deepseek" | "mistral" => {
            client.get(format!("{base}/models"))
        }
        "openrouter" => client.get(format!("{base}/models?output_modalities=all")),
        "anthropic" => client.get(format!("{base}/models?limit=1000")),
        "gemini" => client.get(format!("{base}/models?pageSize=1000")),
        "elevenlabs" => client.get(format!("{base}/models")),
        _ => return Err("El tipo de proveedor no está admitido.".to_string()),
    };

    match request.kind.as_str() {
        "openai" | "compatible" | "groq" | "deepseek" | "openrouter" | "mistral"
            if !api_key.is_empty() =>
        {
            builder = builder.bearer_auth(&api_key);
        }
        "elevenlabs" => {
            if api_key.is_empty() {
                return Err("Escribe la clave API para este proveedor.".to_string());
            }
            builder = builder.header("xi-api-key", &api_key);
        }
        "anthropic" => {
            if api_key.is_empty() {
                return Err("Escribe la clave API para este proveedor.".to_string());
            }
            builder = builder
                .header("x-api-key", &api_key)
                .header("anthropic-version", "2023-06-01");
        }
        "gemini" if !api_key.is_empty() => {
            builder = builder.header("x-goog-api-key", &api_key);
        }
        _ => {}
    }

    let response = send(builder, Duration::from_secs(20), "El proveedor").await?;
    let body = read_json(response, "El proveedor").await?;

    let rows = if request.kind == "gemini" {
        body.get("models")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default()
    } else if request.kind == "elevenlabs" {
        body.as_array().cloned().unwrap_or_default()
    } else {
        body.get("data")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default()
    };

    let mut models: Vec<ProviderModel> = rows
        .iter()
        .filter_map(|row| {
            let raw_id = row
                .get("id")
                .or_else(|| row.get("model_id"))
                .or_else(|| row.get("name"))?
                .as_str()?;
            let id = raw_id.strip_prefix("models/").unwrap_or(raw_id).to_string();
            if id.is_empty() {
                return None;
            }
            let name = row
                .get("displayName")
                .or_else(|| row.get("display_name"))
                .or_else(|| row.get("name"))
                .and_then(Value::as_str)
                .unwrap_or(&id)
                .to_string();
            let methods = row
                .get("supportedGenerationMethods")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
            let has_generate_content = methods.iter().any(|value| {
                value
                    .as_str()
                    .is_some_and(|method| method.eq_ignore_ascii_case("generateContent"))
            });
            let mut capabilities = if request.kind == "elevenlabs" {
                let mut result = Vec::new();
                if row
                    .get("can_do_text_to_speech")
                    .and_then(Value::as_bool)
                    .unwrap_or(false)
                    || row
                        .get("can_do_voice_conversion")
                        .and_then(Value::as_bool)
                        .unwrap_or(false)
                {
                    result.push("voice".to_string());
                }
                result
            } else if request.kind == "openrouter" {
                let outputs = row
                    .pointer("/architecture/output_modalities")
                    .and_then(Value::as_array)
                    .cloned()
                    .unwrap_or_default();
                let mut result = Vec::new();
                for output in outputs.iter().filter_map(Value::as_str) {
                    match output {
                        "text" => result.push("text".to_string()),
                        "image" => result.push("image".to_string()),
                        "audio" => result.push("audio".to_string()),
                        "video" => result.push("video".to_string()),
                        _ => {}
                    }
                }
                if result.is_empty() {
                    infer_capabilities(&request.kind, &id)
                } else {
                    result
                }
            } else {
                infer_capabilities(&request.kind, &id)
            };
            if request.kind == "gemini"
                && !has_generate_content
                && !capabilities
                    .iter()
                    .any(|value| value == "image" || value == "video" || value == "voice")
            {
                capabilities.retain(|value| value != "text");
            }
            Some(ProviderModel {
                id,
                name,
                capabilities,
            })
        })
        .collect();
    if request.kind == "elevenlabs" {
        models.push(ProviderModel {
            id: "eleven_text_to_sound_v2".to_string(),
            name: "Eleven Text to Sound v2".to_string(),
            capabilities: vec!["audio".to_string()],
        });
        models.push(ProviderModel {
            id: "eleven_text_to_sound_v3".to_string(),
            name: "Eleven Text to Sound v3".to_string(),
            capabilities: vec!["audio".to_string()],
        });
    }
    Ok(models)
}

fn infer_capabilities(kind: &str, model_id: &str) -> Vec<String> {
    let id = model_id.to_ascii_lowercase();
    let mut capabilities = Vec::new();
    if id.contains("dall-e")
        || id.contains("gpt-image")
        || id.contains("imagen")
        || id.contains("flux")
        || id.contains("stable-diffusion")
        || id.contains("image-gen")
    {
        capabilities.push("image".to_string());
    }
    if id.contains("sora") || id.contains("veo") || id.contains("video") {
        capabilities.push("video".to_string());
    }
    if id.contains("tts") || id.contains("speech") || id.contains("voice") {
        capabilities.push("voice".to_string());
    }
    if id.contains("text-to-sound")
        || id.contains("sound-generation")
        || id.contains("sound-effects")
        || id.contains("stable-audio")
        || id.contains("music-gen")
        || id.contains("audio-gen")
        || id.contains("eleven_text_to_sound")
    {
        capabilities.push("audio".to_string());
    }
    if id.contains("transcri") || id.contains("whisper") {
        capabilities.push("transcription".to_string());
    }
    if kind == "gemini" && capabilities.is_empty() {
        capabilities.push("text".to_string());
    }
    if capabilities.is_empty() {
        capabilities.push("text".to_string());
    }
    capabilities
}

/// Extracts the provider's own message across the common error shapes
/// (OpenAI/Anthropic/Gemini `error.message`, ElevenLabs `detail`, generic `message`).
fn provider_message(body: &Value) -> Option<String> {
    let raw = body
        .pointer("/error/message")
        .or_else(|| body.pointer("/detail/message"))
        .or_else(|| body.get("detail").filter(|value| value.is_string()))
        .or_else(|| body.get("message"))
        .or_else(|| body.get("error").filter(|value| value.is_string()))
        .and_then(Value::as_str)?;
    let clean: String = raw.split_whitespace().collect::<Vec<_>>().join(" ");
    if clean.is_empty() {
        return None;
    }
    // Never echo anything that looks like a credential back to the UI.
    let lower = clean.to_ascii_lowercase();
    if lower.contains("sk-") || lower.contains("aiza") || lower.contains("bearer ") {
        return None;
    }
    Some(if clean.chars().count() > MAX_PROVIDER_MESSAGE_CHARS {
        format!("{}…", clean.chars().take(MAX_PROVIDER_MESSAGE_CHARS).collect::<String>())
    } else {
        clean
    })
}

fn provider_error(status: StatusCode, body: &Value) -> String {
    let detail = provider_message(body);
    let lower = detail.as_deref().unwrap_or("").to_ascii_lowercase();
    let summary = match status {
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => {
            "El proveedor rechazó la clave o la cuenta no tiene permiso para esta operación."
        }
        _ if lower.contains("api key") || lower.contains("authentication") => {
            "El proveedor rechazó la clave o la cuenta no tiene permiso para esta operación."
        }
        StatusCode::TOO_MANY_REQUESTS => {
            "Límite de uso alcanzado o cuota agotada. Espera un momento o revisa tu plan."
        }
        StatusCode::NOT_FOUND => "El modelo o el recurso solicitado no existe en este proveedor.",
        StatusCode::PAYLOAD_TOO_LARGE => "La solicitud es demasiado grande para el proveedor.",
        StatusCode::REQUEST_TIMEOUT | StatusCode::GATEWAY_TIMEOUT => {
            "El proveedor tardó demasiado en responder."
        }
        StatusCode::BAD_REQUEST | StatusCode::UNPROCESSABLE_ENTITY => {
            "El proveedor rechazó la solicitud."
        }
        status if status.is_server_error() => {
            "El proveedor no está disponible en este momento. Inténtalo más tarde."
        }
        _ => "",
    };
    match (summary.is_empty(), detail) {
        (true, Some(detail)) => format!("El proveedor respondió con HTTP {}: {detail}", status.as_u16()),
        (true, None) => format!("El proveedor respondió con HTTP {}.", status.as_u16()),
        (false, Some(detail)) => format!("{summary} ({detail})"),
        (false, None) => summary.to_string(),
    }
}

#[tauri::command]
fn store_provider_api_key(profile_id: String, api_key: String) -> Result<(), String> {
    if profile_id.trim().is_empty() || api_key.trim().is_empty() {
        return Err("El perfil y la clave API son obligatorios.".to_string());
    }
    if api_key.len() > 4096 || api_key.chars().any(char::is_control) {
        return Err("La clave API contiene caracteres no válidos o es demasiado larga.".to_string());
    }
    keyring_entry(&profile_id)?
        .set_password(api_key.trim())
        .map_err(|_| "No se pudo guardar la clave en el llavero de Windows.".to_string())
}

#[tauri::command]
fn delete_provider_api_key(profile_id: String) -> Result<(), String> {
    match keyring_entry(&profile_id)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(_) => Err("No se pudo quitar la clave del llavero de Windows.".to_string()),
    }
}

#[tauri::command]
fn provider_api_key_configured(profile_id: String) -> Result<bool, String> {
    match keyring_entry(&profile_id)?.get_password() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(_) => Err("No se pudo consultar el llavero de Windows.".to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            list_provider_models,
            list_elevenlabs_voices,
            generate_elevenlabs_audio,
            chat_with_provider,
            store_provider_api_key,
            delete_provider_api_key,
            provider_api_key_configured
        ])
        .run(tauri::generate_context!())
        .expect("error while running Sparta Video");
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn checked_url_accepts_http_and_trims_trailing_slash() {
        assert_eq!(checked_url(" https://api.openai.com/v1/ ").unwrap(), "https://api.openai.com/v1");
        assert_eq!(checked_url("http://localhost:11434/v1").unwrap(), "http://localhost:11434/v1");
    }

    #[test]
    fn checked_url_rejects_unsafe_urls() {
        for url in ["ftp://example.com", "https://user:pass@example.com", "https://example.com/v1?key=1", "not a url", "file:///etc/passwd"] {
            assert!(checked_url(url).is_err(), "{url} should be rejected");
        }
    }

    #[test]
    fn profile_ids_are_validated() {
        assert!(validate_profile_id("provider-abc_123").is_ok());
        assert!(validate_profile_id("").is_err());
        assert!(validate_profile_id("bad id").is_err());
        assert!(validate_profile_id(&"x".repeat(129)).is_err());
    }

    #[test]
    fn provider_error_maps_common_statuses() {
        assert!(provider_error(StatusCode::UNAUTHORIZED, &Value::Null).contains("clave"));
        assert!(provider_error(StatusCode::TOO_MANY_REQUESTS, &Value::Null).contains("Límite"));
        assert!(provider_error(StatusCode::NOT_FOUND, &Value::Null).contains("no existe"));
        assert!(provider_error(StatusCode::BAD_GATEWAY, &Value::Null).contains("no está disponible"));
        assert_eq!(provider_error(StatusCode::IM_A_TEAPOT, &Value::Null), "El proveedor respondió con HTTP 418.");
    }

    #[test]
    fn provider_error_includes_sanitized_provider_message() {
        let openai = json!({"error": {"message": "The model `gpt-x` does not exist"}});
        assert!(provider_error(StatusCode::NOT_FOUND, &openai).contains("gpt-x"));
        let eleven = json!({"detail": {"message": "Quota   exceeded"}});
        assert!(provider_error(StatusCode::TOO_MANY_REQUESTS, &eleven).contains("(Quota exceeded)"));
        let leaky = json!({"error": {"message": "Incorrect API key provided: sk-abc123"}});
        assert!(!provider_error(StatusCode::UNAUTHORIZED, &leaky).contains("sk-"));
    }

    #[test]
    fn blocked_responses_are_detected() {
        assert!(blocked_reason("gemini", &json!({"promptFeedback": {"blockReason": "SAFETY"}})).is_some());
        assert!(blocked_reason("openai", &json!({"choices": [{"finish_reason": "content_filter"}]})).is_some());
        assert!(blocked_reason("openai", &json!({"choices": [{"finish_reason": "stop"}]})).is_none());
        assert!(blocked_reason("anthropic", &json!({"stop_reason": "end_turn"})).is_none());
    }

    #[test]
    fn infers_capabilities_from_model_ids() {
        assert_eq!(infer_capabilities("openai", "gpt-4o"), vec!["text"]);
        assert_eq!(infer_capabilities("openai", "whisper-1"), vec!["transcription"]);
        assert!(infer_capabilities("openai", "gpt-image-1").contains(&"image".to_string()));
        assert!(infer_capabilities("openai", "tts-1").contains(&"voice".to_string()));
    }
}
