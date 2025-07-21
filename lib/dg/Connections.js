import WebSocket from "ws"
import { pluginName } from "../Path.js"
import QRCode from "qrcode"
import { randomUUID } from "crypto"
/**
 * @type {Map<string, Connection>}
 */
const Connections = new Map()
export { start, Connections }

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
/**
 *
 * @param {string} serverUrl
 * @param {number | string} qq
 * @param {boolean | string} newId
 * @returns
 */
async function start(serverUrl, qq, newId = false) {
  try {
    const connection = new Connection(serverUrl, newId)
    Connections.set(qq, connection)
    connection.name = qq
    return connection
  } catch (err) {
    logger.error(err)
    return false
  }
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
    this.unbind = false
    this.#initWebSocket()
  }
  removeAllListeners() {
    this.listener.clear()
  }
  #initWebSocket() {
    this.ws.on("open", () => {
      if (this.newId) {
        this.ws.send(JSON.stringify({ type: "uuid", uuid: this.newId }))
      }
      this.#log("已连接到服务器")
    })

    this.ws.on("message", data => this.#handleMessage(data))
    this.ws.on("close", () => this.#handleClose())
    this.ws.on("error", error => logger.error(this.#logPrefix(), "WebSocket 错误:", error))
  }

  #handleMessage(data) {
    let message
    try {
      message = JSON.parse(data)
    } catch {
      return logger.info("收到非JSON格式消息:", data)
    }
    this.emit("message", message)
    switch (message.type) {
      case "bind":
        this.#handleBind(message)
        break
      case "msg":
        this.#log("收到消息:", message)
        this.#handleMsg(message)
        break
      case "heartbeat":
        this.#log("心跳检测:", message)
        break
      default:
        this.#log("未知消息类型:", message)
    }
  }

  #handleBind(message) {
    if (!this.clientId && message.clientId) {
      this.clientId = this.newId || message.clientId
      if (!this.newId) this.#log("绑定成功:", message)
      this.emit("clientIdBound", { clientId: this.clientId, serverUrl: this.serverUrl })
    }

    if (!this.targetId && message.targetId) {
      this.targetId = message.targetId
      this.#log("targetid 绑定成功:", message.targetId)
      this.#emitDeviceConnected()
    }
  }

  #handleMsg(message) {
    if (!this.targetId && message.targetId) {
      this.targetId = message.targetId
      this.#log("targetid 绑定成功:", message.targetId)
      this.#emitDeviceConnected()
    }

    if (/^strength/.test(message.message)) {
      const match = message.message.match(/strength-(\d+)\+(\d+)\+(\d+)\+(\d+)/)
      if (match) {
        ;[, this.A, this.B, this.A_S, this.B_S] = match.map(Number)
      }
    }
  }

  #handleClose() {
    this.#log("连接已关闭")
    this.emit("close", { clientId: this.clientId, buffer: this.buffer })
    this.clientId = this.targetId = ""
  }

  #emitDeviceConnected() {
    this.emit("deviceConnected", {
      clientId: this.clientId,
      targetId: this.targetId,
      A: this.A,
      B: this.B,
      A_S: this.A_S,
      B_S: this.B_S,
    })
  }

  #log(...args) {
    logger.info(this.#logPrefix(), ...args)
  }

  #logPrefix() {
    return `[${pluginName}][${this.name || this.clientId}]`
  }

  async startConnection() {
    // 等待 clientId
    for (let i = 0; i < 10; i++) {
      if (this.clientId) break
      if (i === 9) {
        this.emit("connectionFailed", { reason: "clientId timeout" })
        return false
      }
      await sleep(1000)
    }

    try {
      const qrUrl = `https://www.dungeon-lab.com/app-download.php#DGLAB-SOCKET#${this.serverUrl}${this.clientId}`
      this.buffer = await QRCode.toBuffer(qrUrl)

      this.emit("qrCodeGenerated", { qrUrl, buffer: this.buffer, clientId: this.clientId })

      // 等待设备连接
      for (let n = 0; n < 20; n++) {
        if (this.检查ID状态()) {
          this.emit("Connected", { clientId: this.clientId, qq: this.name })
          return this
        }
        await sleep(2000)
        if (n === 19) {
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

  on(event, callback) {
    if (typeof callback !== "function") throw new Error("callback must be a function")
    const id = randomUUID()
    this.listener.set(id, Object.assign(callback, { event, id }))
    return id
  }

  off(id) {
    this.listener.delete(id)
  }

  emit(event, data) {
    this.listener.forEach(callback => {
      if (callback.event === event) callback(data, this)
    })
  }

  检查ID状态(id = "targetId") {
    return id === "targetId" ? this.targetId !== "" : this.clientId !== ""
  }

  发送波形消息(Target, wave, time) {
    const channel = Target.toUpperCase()
    this.发送自定义消息({
      type: "clientMsg",
      message: `${channel}: ${wave}`,
      clientId: this.clientId,
      targetId: this.targetId,
      time,
      channel,
    })
  }

  发送强度调节指令(type, channel, strength, message = "set channel") {
    if (!this.clientId) {
      return logger.error(this.#logPrefix(), "clientId 未初始化")
    }

    if (channel === "A") channel = 1
    else if (channel === "B") channel = 2
    else if (!/^\d+$/.test(channel)) throw "channel参数非法"

    return this.发送自定义消息({
      type,
      strength,
      message,
      channel,
      clientId: this.clientId,
      targetId: this.targetId,
    })
  }

  async 设置通道强度(Target, Number_) {
    const channelMap = { A: 1, B: 2 }
    const channel = channelMap[Target.toUpperCase()] || Target

    this.发送自定义消息({
      type: 4,
      clientId: this.clientId,
      targetId: this.targetId,
      message: `strength-${channel}+2+${Number_}`,
    })

    logger.info(`通道${Target}的强度已调整到 ${Number_}`)
    return true
  }

  #调节通道强度(type, channel) {
    if (!this.targetId) {
      return logger.error(this.#logPrefix(), "未连接设备")
    }
    return this.发送强度调节指令(type, channel, 1)
  }

  增加A通道强度() {
    return this.#调节通道强度(2, "A")
  }
  减少A通道强度() {
    return this.#调节通道强度(1, "A")
  }
  增加B通道强度() {
    return this.#调节通道强度(2, "B")
  }
  减少B通道强度() {
    return this.#调节通道强度(1, "B")
  }

  清空波形队列(Target) {
    const channelMap = { A: 1, B: 2 }
    const channel = channelMap[Target.toUpperCase()] || Target

    return this.发送自定义消息({
      type: "msg",
      clientId: this.clientId,
      targetId: this.targetId,
      message: `clear-${channel}`,
      channel: Target,
    })
  }

  发送自定义消息(data) {
    this.#log("发送消息:", JSON.stringify(data, null, 1))
    this.ws.send(JSON.stringify(data))
  }

  断开连接() {
    this.removeAllListeners()
    this.ws.close()
  }
}

const 解析波形数据 = waveForms =>
  waveForms.map(waveForm => {
    const [hex1, hex2] = waveForm.map(arr =>
      arr.map(value => value.toString(16).padStart(2, "0")).join(""),
    )
    return hex1 + hex2
  })
