import { fileURLToPath } from "url"
import path from "path"
const Path = process.cwd()
const __dirname = (path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..") + "/").replace(
  /\\/g,
  "/",
)
const pluginName = "dg-lab-russian-roulette"

const PluginPath = path.join(Path, "plugins", pluginName)
export { __dirname, pluginName, PluginPath }
