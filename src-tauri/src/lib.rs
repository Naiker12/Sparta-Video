use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use keyring::Entry;
use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

const KEYRING_SERVICE: &str = "com.sparta.video.ai-provider";

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
    let response = Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|_| "No se pudo iniciar el cliente HTTP.".to_string())?
        .get(format!("{api_root}/v2/voices?page_size=100"))
        .header("xi-api-key", key)
        .send()
        .await
        .map_err(|_| "No se pudo conectar con ElevenLabs.".to_string())?;
    let status = response.status();
    let body: Value = response
        .json()
        .await
        .map_err(|_| "ElevenLabs devolvió una respuesta no válida.".to_string())?;
    if !status.is_success() {
        return Err(provider_error(status, &body));
    }
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
    let client = Client::builder()
        .timeout(Duration::from_secs(90))
        .build()
        .map_err(|_| "No se pudo iniciar el cliente HTTP.".to_string())?;
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
    let response = client
        .post(url)
        .header("xi-api-key", key)
        .json(&payload)
        .send()
        .await
        .map_err(|error| {
            if error.is_timeout() {
                "La generación tardó demasiado.".to_string()
            } else {
                "No se pudo conectar con ElevenLabs.".to_string()
            }
        })?;
    let status = response.status();
    if !status.is_success() {
        let body = response.json::<Value>().await.unwrap_or(Value::Null);
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
        "Ayuda a planear un video nuevo con ideas concretas para guion, escenas y recursos. No afirmes que generaste medios ni que cambiaste el proyecto."
    } else {
        "Ayuda a analizar y mejorar la edición actual con propuestas concretas. No afirmes que modificaste el proyecto."
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
    let client = Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|_| "No se pudo iniciar el cliente HTTP.".to_string())?;

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
            url.query_pairs_mut().append_pair("key", &api_key);
            let contents: Vec<Value> = request.messages.iter().map(|message| {
                serde_json::json!({"role": if message.role == "assistant" { "model" } else { "user" }, "parts": [{"text": message.content}]})
            }).collect();
            (
                url.to_string(),
                serde_json::json!({"systemInstruction": {"parts": [{"text": system}]}, "contents": contents, "generationConfig": {"maxOutputTokens": 2048}}),
                "none",
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
            (url.to_string(), body, "bearer")
        }
    };
    let mut builder = client.post(url).json(&body);
    match auth_header {
        "bearer" if !api_key.is_empty() => builder = builder.bearer_auth(api_key),
        "anthropic" => {
            builder = builder
                .header("x-api-key", api_key)
                .header("anthropic-version", "2023-06-01")
        }
        _ => {}
    }
    let response = builder.send().await.map_err(|error| {
        if error.is_timeout() {
            "El modelo tardó demasiado en responder.".to_string()
        } else {
            "No se pudo conectar con el proveedor de IA.".to_string()
        }
    })?;
    let status = response.status();
    let payload: Value = response
        .json()
        .await
        .map_err(|_| "El proveedor devolvió una respuesta no válida.".to_string())?;
    if !status.is_success() {
        return Err(provider_error(status, &payload));
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
    {
        return Err("La URL debe usar HTTP o HTTPS y no incluir credenciales.".to_string());
    }
    Ok(base_url.trim().trim_end_matches('/').to_string())
}

#[tauri::command]
async fn list_provider_models(request: ProviderRequest) -> Result<Vec<ProviderModel>, String> {
    let base = checked_url(&request.base_url)?;
    let api_key = api_key_for(&request.profile_id, request.api_key)?;
    let client = Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|_| "No se pudo iniciar el cliente HTTP.".to_string())?;

    let mut builder = match request.kind.as_str() {
        "openai" | "compatible" | "groq" | "deepseek" | "mistral" => {
            client.get(format!("{base}/models"))
        }
        "openrouter" => client.get(format!("{base}/models?output_modalities=all")),
        "anthropic" => client.get(format!("{base}/models?limit=1000")),
        "gemini" => client.get(format!("{base}/models")),
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

    let response = builder.send().await.map_err(|error| {
        if error.is_timeout() {
            "El proveedor tardó demasiado en responder.".to_string()
        } else {
            "No se pudo conectar con el proveedor. Revisa la URL y la red.".to_string()
        }
    })?;
    let status = response.status();
    let body: Value = response
        .json()
        .await
        .map_err(|_| "El proveedor devolvió una respuesta que no es JSON.".to_string())?;
    if !status.is_success() {
        return Err(provider_error(status, &body));
    }

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

fn provider_error(status: StatusCode, body: &Value) -> String {
    let message = body
        .pointer("/error/message")
        .or_else(|| body.get("message"))
        .and_then(Value::as_str)
        .unwrap_or("");
    let lower = message.to_ascii_lowercase();
    if status == StatusCode::UNAUTHORIZED
        || status == StatusCode::FORBIDDEN
        || lower.contains("api key")
        || lower.contains("authentication")
    {
        "El proveedor rechazó la clave o no tiene permiso para consultar modelos.".to_string()
    } else {
        format!("El proveedor respondió con HTTP {}.", status.as_u16())
    }
}

#[tauri::command]
fn store_provider_api_key(profile_id: String, api_key: String) -> Result<(), String> {
    if profile_id.trim().is_empty() || api_key.trim().is_empty() {
        return Err("El perfil y la clave API son obligatorios.".to_string());
    }
    keyring_entry(&profile_id)?
        .set_password(&api_key)
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
