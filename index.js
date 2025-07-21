import fs from "fs/promises"
import path from "node:path"
import { pluginName } from "./lib/Path.js"
let AppName = pluginName
let loadedFilesCount = 0
let loadedFilesCounterr = 0
let apps
// dg_lab_russian_roulette.is_TRSS =
  // JSON.parse(await fs.readFile(`${process.cwd()}/package.json`)).name == "trss-yunzai"
const startTime = Date.now()
logger.mark("------------------")
logger.debug("\x1b[36mDG正在加载中...\x1b[0m")
logger.info(`\x1b[33m${AppName}插件初始化~\x1b[0m`)
const {
  apps: loadedApps,
  loadedFilesCount: count,
  loadedFilesCounterr: counterr,
} = await appsOut({ AppsName: "apps" })
const endTime = Date.now()
apps = loadedApps
loadedFilesCount = count
loadedFilesCounterr = counterr
logger.mark("------------------")
logger.info(
  logger.yellow(
    `[${AppName}] 共加载了 ${loadedFilesCount} 个插件文件 ${loadedFilesCounterr} 个失败 耗时 ${endTime - startTime} 毫秒`,
  ),
)
export { apps }

async function appsOut({ AppsName }) {
  const firstName = path.join("plugins", AppName)
  const filepath = path.resolve(firstName, AppsName)
  let loadedFilesCount = 0
  let loadedFilesCounterr = 0
  const apps = {}

  try {
    const jsFilePaths = await traverseDirectory(filepath)
    await Promise.all(
      jsFilePaths.map(async item => {
        try {
          const allExport = await import(`file://${item}`)

          for (const key of Object.keys(allExport)) {
            if (typeof allExport[key] === "function" && allExport[key].prototype) {
              let className = key
              if (Object.prototype.hasOwnProperty.call(apps, className)) {
                let counter = 1
                while (Object.prototype.hasOwnProperty.call(apps, `${className}_${counter}`)) {
                  counter++
                }
                className = `${className}_${counter}`
                logger.info(`[${AppName}] 同名导出 ${key} 重命名为 ${className} : ${item}`)
              }
              apps[className] = allExport[key]
              loadedFilesCount++
            }
          }
        } catch (error) {
          logger.error(`[${AppName}] 加载 ${item} 文件失败: ${error.message}`)
          loadedFilesCounterr++
        }
      }),
    )
  } catch (error) {
    logger.error("读取插件目录失败:", error.message)
  }

  return { apps, loadedFilesCount, loadedFilesCounterr }
}

async function traverseDirectory(dir) {
  try {
    const files = await fs.readdir(dir, { withFileTypes: true })
    const jsFiles = []
    for await (const file of files) {
      const pathname = path.join(dir, file.name)
      if (file.isDirectory()) {
        jsFiles.push(...(await traverseDirectory(pathname)))
      } else if (file.name.endsWith(".js")) {
        jsFiles.push(pathname)
      }
    }
    return jsFiles
  } catch (error) {
    logger.error("读取插件目录失败:", error.message)
    return []
  }
}
