import { Connections, start } from "./lib/dg/Connections.js"
global.logger = console
let client = await start(
  {
    reply: function (...args) {
      return console.log(...args)
    },
  },
  "ws://111.229.158.178:9999/",
  2173302144,
)
client.on("close", handler)
async function handler({ clientId, buffer }) {
  console.log(`连接已关闭: ${clientId},开始尝试重连`)
  await start(
    {
      reply: function (...args) {
        return console.log(...args)
      },
    },
    "ws://111.229.158.178:9999/",
    2173302144,
    clientId,
  )
}
