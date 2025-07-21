import { Connections, start } from "../lib/dg/Connections.js"
import plugin from "../../../lib/plugins/plugin.js"

export class Manage extends plugin {
  constructor() {
    super({
      name: "[郊狼轮盘赌]设备管理",
      dsc: "绑定设备",
      event: "message",
      priority: 0,
      rule: [
        {
          reg: "^#(绑定|(连|链|联)接)郊狼$",
          fnc: "bind",
        },
      ],
    })
  }

  setupClientListeners(client, user_id, group_id, e) {
    client.on("close", async ({ clientId }) => {
      logger.debug(`[郊狼轮盘赌] ${user_id} 连接已关闭,开始重连`)
      Connections.delete(user_id)

      try {
        let cli = await start("ws://111.229.158.178:9999/", user_id, clientId)
        Connections.set(user_id, cli)
        this.setupClientListeners(cli, user_id, group_id, e)
        await cli.startConnection()
        Bot.pickGroup(group_id).sendMsg(`[郊狼轮盘赌] ${user_id} 连接已关闭,正在重连...`)
      } catch (error) {
        logger.error(`[郊狼轮盘赌] ${user_id} 重连失败`, error)
        Bot.pickGroup(group_id).sendMsg(`[郊狼轮盘赌] ${user_id} 重连失败`)
      }
    })

    client.on("qrCodeGenerated", function ({ buffer }) {
      logger.debug(`[郊狼轮盘赌] ${user_id} 二维码已生成`)
      e.reply([
        "二维码已生成,请扫码绑定设备",
        { type: "image", file: "base64://" + buffer.toString("base64") },
      ])
    })

    client.on("deviceConnected", async ({ clientId, targetId, A, B, A_S, B_S }) => {
      logger.debug(`[郊狼轮盘赌] ${user_id} 连接完成`)
      const message = `用户${client.name}的设备\n状态: 已连接\n设备状态: 设备已连接\nA通道强度大小: ${A}\nB通道强度大小: ${B}\nA通道强度大小上限: ${A_S}\nB通道强度大小上限: ${B_S}`

      if (!(await e.reply(message))) {
        Bot.pickGroup(group_id).sendMsg(`[郊狼轮盘赌] ${message}`)
      }
    })

    client.on("connectionFailed", async ({ reason, error }) => {
      logger.error(`[郊狼轮盘赌] ${user_id} 连接失败`, reason, error)
      client.断开连接()
      Connections.delete(user_id)

      const failMessage = `[郊狼轮盘赌] ${user_id} 连接失败: ${reason}`
      if (!(await e.reply(failMessage))) {
        Bot.pickGroup(group_id).sendMsg(failMessage)
      }
    })
  }

  async bind(e) {
    const { user_id, group_id } = e
    const connection = Connections.get(user_id)

    if (connection) {
      if (!connection.unbind) {
        connection.unbind = true
        return await e.reply("已经绑定过了,如需绑定新设备请二次发送该指令")
      } else {
        connection.断开连接()
        Connections.delete(user_id)
      }
    }

    try {
      const client = await start("ws://111.229.158.178:9999/", user_id)
      this.setupClientListeners(client, user_id, group_id, e)
      Connections.set(user_id, client)
      await client.startConnection()

      await e.reply("设备绑定成功")
    } catch (error) {
      logger.error(`[郊狼轮盘赌] ${user_id} 绑定失败`, error)
      await e.reply("设备绑定失败，请稍后重试")
    }
  }
}
