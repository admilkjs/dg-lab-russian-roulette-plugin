import WebSocket from "ws"
import { pluginName } from "../Path.js"
import path from "path"
import QRCode from "qrcode"
import { randomUUID } from "crypto"

let Connections = {
  connections: {},
}

export { start, Connections }

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function start(serverUrl, qq, newId = false) {
  async function _start(serverUrl, qq) {
    let connection = new Connection(serverUrl, newId)
    Connections.connections[qq] = connection
    connection.name = qq
    return
  }

  try {
    await _start(serverUrl, qq)
  } catch (err) {
    logger.error(err)
    return false
  }
  return Connections.connections[qq]
}

class Connection {
  constructor(serverUrl, newId = false) {
    this.ws = new WebSocket(serverUrl)
    this.clientId = ""
    this.targetId = ""
    this.name = ""
    this.listener = new Map()
    this.A = 0
    this.B = 0
    this.A_S = 0
    this.B_S = 0
    this.buffer = null
    this.serverUrl = serverUrl
    this.newId = newId

    this.ws.on("open", () => {
      if (newId) {
        this.ws.send(
          JSON.stringify({
            type: "uuid",
            uuid: newId,
          }),
        )
      }
      logger.info(
        `[${pluginName}]${this.name != "" ? `[${this.name}]` : `[${this.clientId}]`} 已连接到服务器`,
      )
    })

    this.ws.on("message", data => {
      let message
      try {
        message = JSON.parse(data)
      } catch {
        logger.info("收到非JSON格式消息:", data)
        return
      }

      switch (message.type) {
        case "bind":
          if (!this.clientId && message.clientId) {
            if (newId) this.clientId = newId
            else {
              logger.info(
                `[${pluginName}]${this.name != "" ? `[${this.name}]` : `[${this.clientId}]`} 绑定成功:`,
                message,
              )
              this.clientId = message.clientId
            }
            this.emit("clientIdBound", { clientId: this.clientId, serverUrl: this.serverUrl })
          }
          if (!this.targetId && message.targetId) {
            this.targetId = message.targetId
            logger.info(
              `[${pluginName}]${this.name != "" ? `[${this.name}]` : `[${this.clientId}]`} targetid 绑定成功:`,
              message.targetId,
            )
            this.emit("deviceConnected", {
              clientId: this.clientId,
              targetId: this.targetId,
              A: this.A,
              B: this.B,
              A_S: this.A_S,
              B_S: this.B_S,
            })
          }
          break
        case "msg":
          logger.info(
            `[${pluginName}]${this.name != "" ? `[${this.name}]` : `[${this.clientId}]`} 收到消息:`,
            message,
          )
          if (!this.targetId && message.targetId) {
            this.targetId = message.targetId
            logger.info(
              `[${pluginName}]${this.name != "" ? `[${this.name}]` : `[${this.clientId}]`} targetid 绑定成功:`,
              message.targetId,
            )
            // 触发设备连接成功事件
            this.emit("deviceConnected", {
              clientId: this.clientId,
              targetId: this.targetId,
              A: this.A,
              B: this.B,
              A_S: this.A_S,
              B_S: this.B_S,
            })
          }
          if (/^strength/.test(message.message)) {
            let match = message.message.match(/strength-(\d+)\+(\d+)\+(\d+)\+(\d+)/)
            if (match) {
              this.A = Number(match[1])
              this.B = Number(match[2])
              this.A_S = Number(match[3])
              this.B_S = Number(match[4])
            }
          }
          break
        case "heartbeat":
          logger.info(
            `[${pluginName}]${this.name != "" ? `[${this.name}]` : `[${this.clientId}]`} 心跳检测:`,
            message,
          )
          break
        default:
          logger.info(
            `[${pluginName}]${this.name != "" ? `[${this.name}]` : `[${this.clientId}]`} 未知消息类型:`,
            message,
          )
      }
    })

    this.ws.on("close", () => {
      logger.info(
        `[${pluginName}]${this.name != "" ? `[${this.name}]` : `[${this.clientId}]`} 连接已关闭`,
      )
      this.emit("close", { clientId: this.clientId, buffer: this.buffer })
      this.clientId = ""
      this.targetId = ""
    })

    this.ws.on("error", error => {
      logger.error(
        `[${pluginName}]${this.name != "" ? `[${this.name}]` : `[${this.clientId}]`} WebSocket 错误:`,
        error,
      )
    })
  }

  // 新增的启动连接方法
  async startConnection() {
    // 等待 clientId 获取
    for (let i = 0; i < 10; i++) {
      if (this.clientId) break
      if (i == 9) {
        this.emit("connectionFailed", { reason: "clientId timeout" })
        return false
      }
      await sleep(1000)
    }

    // 生成二维码 URL 和数据
    const qrUrl = `https://www.dungeon-lab.com/app-download.php#DGLAB-SOCKET#${this.serverUrl}${this.clientId}`

    try {
      const buffer = await this.生成二维码(qrUrl)
      this.buffer = buffer

      // 触发二维码生成事件
      this.emit("qrCodeGenerated", {
        qrUrl,
        buffer,
        clientId: this.clientId,
      })

      // 等待设备连接
      let cs = 20
      for (let n = 0; n < cs; n++) {
        if (this.检查ID状态()) {
          // 设备连接成功已经在 message 处理中触发了 deviceConnected 事件
          return this
        }
        await sleep(2000)
        if (n === cs - 1) {
          this.emit("connectionFailed", { reason: "device connection timeout" })
          this.断开连接()
          return false
        }
      }
    } catch (err) {
      this.emit("connectionFailed", { reason: "qr code generation failed", error: err })
      return false
    }
  }

  async 生成二维码(url) {
    return await QRCode.toBuffer(url)
  }

  on(event, callback) {
    if (typeof callback != "function") throw new Error("callback must be a function")
    const id = randomUUID()
    callback = Object.assign(callback, { event: event, id: id })
    this.listener.set(id, callback)
    return id
  }

  off(id) {
    this.listener.delete(id)
  }

  emit(event, data) {
    this.listener.forEach(callback => {
      if (callback.event == event) callback(data, this)
    })
  }

  检查ID状态(id = "targetId") {
    if (id == "targetId") return this.targetId != ""
    if (id == "clientId") return this.clientId != ""
  }

  发送波形消息(Target, wave, time) {
    Target = Target.toUpperCase()
    const data = {
      type: "clientMsg",
      message: `${Target}: ${wave}`,
      clientId: this.clientId,
      targetId: this.targetId,
      time,
      channel: Target,
    }
    this.发送自定义消息(data)
  }

  发送强度调节指令(type, channel, strength, message = "set channel") {
    if (!this.clientId) {
      logger.error(
        `[${pluginName}]${this.name != "" ? `[${this.name}]` : `[${this.clientId}]`} clientId 未初始化`,
      )
      return
    }
    switch (channel) {
      case "A":
        channel = 1
        break
      case "B":
        channel = 2
        break
      default:
        if (!/^(\d+)$/.test(channel)) throw "channel参数非法"
        break
    }
    const data = {
      type,
      strength,
      message,
      channel,
      clientId: this.clientId,
      targetId: this.targetId,
    }
    return this.发送自定义消息(data)
  }

  async 设置通道强度(Target, Number_) {
    let channel
    Target = Target.toUpperCase() || Number(Target) || Target
    switch (Target) {
      case "A":
        channel = 1
        break
      case "B":
        channel = 2
        break
      default:
        channel = Target
    }
    const data = {
      type: 4,
      clientId: this.clientId,
      targetId: this.targetId,
      message: `strength-${channel}+2+${Number_}`,
    }
    this.发送自定义消息(data)
    logger.info(`通道${Target}的强度已调整到 ${Number_}`)
    return true
  }

  增加A通道强度() {
    if (!this.targetId)
      return logger.error(
        `[${pluginName}]${this.name != "" ? `[${this.name}]` : `[${this.clientId}]`} 未连接设备`,
      )
    return this.发送强度调节指令(2, "A", 1)
  }

  减少A通道强度() {
    if (!this.targetId)
      return logger.error(
        `[${pluginName}]${this.name != "" ? `[${this.name}]` : `[${this.clientId}]`} 未连接设备`,
      )
    return this.发送强度调节指令(1, "A", 1)
  }

  增加B通道强度() {
    if (!this.targetId)
      return logger.error(
        `${pluginName}]${this.name != "" ? `[${this.name}]` : `[${this.clientId}]`} 未连接设备`,
      )
    return this.发送强度调节指令(2, "B", 1)
  }

  减少B通道强度() {
    if (!this.targetId)
      return logger.error(
        `[${pluginName}]${this.name != "" ? `[${this.name}]` : `[${this.clientId}]`} 未连接设备`,
      )
    return this.发送强度调节指令(1, "B", 1)
  }

  清空波形队列(Target) {
    Target = Target.toUpperCase() || Number(Target) || Target
    let channel
    switch (Target) {
      case "A":
        channel = 1
        break
      case "B":
        channel = 2
        break
      default:
        break
    }
    let msg = `clear-${channel}`
    const data = {
      type: "msg",
      clientId: this.clientId,
      targetId: this.targetId,
      message: msg,
      channel: Target,
    }
    return this.发送自定义消息(data)
  }

  发送自定义消息(data) {
    logger.info(
      `[${pluginName}]${this.name != "" ? `[${this.name}]` : `[${this.clientId}]`} 发送消息: ${JSON.stringify(data, null, 1)}`,
    )
    this.ws.send(JSON.stringify(data))
  }

  断开连接() {
    this.ws.close()
  }
}

function 解析波形数据(waveForms) {
  const hexWaveForms = waveForms.map(waveForm => {
    const hex1 = waveForm[0].map(value => value.toString(16).padStart(2, "0")).join("")
    const hex2 = waveForm[1].map(value => value.toString(16).padStart(2, "0")).join("")
    return hex1 + hex2
  })
  return hexWaveForms
}
