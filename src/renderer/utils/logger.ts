export class RendererLogger {
  static info(tag: string, message: string) {
    window.electronAPI?.logFromRenderer('info', tag, message);
  }

  static warn(tag: string, message: string) {
    window.electronAPI?.logFromRenderer('warn', tag, message);
  }

  static error(tag: string, message: string) {
    window.electronAPI?.logFromRenderer('error', tag, message);
  }

  static debug(tag: string, message: string) {
    window.electronAPI?.logFromRenderer('debug', tag, message);
  }
}
