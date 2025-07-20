import { Connections, start } from "./lib/dg/Connections.js"
import fs from "fs/promises"
global.logger = console
await 一键监听(await start("ws://111.229.158.178:9999/", 2173302144))
async function 一键监听(client) {
  client.on("close", handler)
  client.on("qrCodeGenerated", async function ({ buffer }) {
    console.log("二维码已生成")
    await fs.writeFile(`./qrcode.png`, buffer)
    client.buffer = buffer
  })
  client.on("deviceConnected", ({ clientId, targetId, A, B, A_S, B_S }) => {
    console.log("连接完成")
    console.log(
      `用户${client.name}的设备\n状态: 已连接\n设备状态: 设备已连接\nA通道强度大小: ${A}\nB通道强度大小: ${B}\nA通道强度大小上限: ${A_S}\nB通道强度大小上限: ${B_S}`,
    )
  })
  client.on("connectionFailed", ({ reason, error }) => {
    console.log("连接失败")
    delete Connections.connections[client.name]
  })
  await client.startConnection()
}
async function handler({ clientId, buffer }) {
  console.log(`连接已关闭: ${clientId},开始尝试重连`)
  await start("ws://111.229.158.178:9999/", 2173302144, clientId)
}
