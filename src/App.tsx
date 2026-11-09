import { EditorShell, type EditorShellProps } from './features/editor/shell/EditorShell'
import { useLanguage } from './shared/i18n/locale'

export function App(props: EditorShellProps) {
  useLanguage()
  return <EditorShell {...props} />
}

export default App
