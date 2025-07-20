// import WebSocket, { WebSocketServer } from "ws"
// import { v4 as uuidv4 } from "uuid"
// // 储存已连接的用户及其标识
// const clients = new Map()

// // 存储消息关系
// const relations = new Map()

// const punishmentDuration = 5 //默认发送时间1秒

// const punishmentTime = 1 // 默认一秒发送1次

// // 存储客户端和发送计时器关系
// const clientTimers = new Map()

// // 定义心跳消息
// const heartbeatMsg = {
//   type: "heartbeat",
//   clientId: "",
//   targetId: "",
//   message: "200",
// }

// // 定义定时器
// let heartbeatInterval

// const wss = new WebSocketServer({ port: 4562 })

// wss.on("connection", function connection(ws) {
//   let clientId = uuidv4()

//   console.log("新的 WebSocket 连接已建立，标识符为:", clientId)

//   //存储
//   clients.set(clientId, ws)

//   // 发送标识符给客户端（格式固定，双方都必须获取才可以进行后续通信：比如浏览器和APP）
//   ws.send(JSON.stringify({ type: "bind", clientId, message: "targetId", targetId: "" }))

//   // 监听发信
//   ws.on("message", function incoming(message) {
//     console.log("收到消息：" + message)
//     let data = null
//     try {
//       data = JSON.parse(message)
//     } catch (e) {
//       // 非JSON数据处理
//       ws.send(JSON.stringify({ type: "msg", clientId: "", targetId: "", message: "403" }))
//       return
//     }
//     if (data.type === "uuid") {
//       clients.set(data.uuid, ws)
//       clients.delete(clientId) // 删除旧的 clientId
//       clientId = data.uuid // 更新 clientId
//     }
//     // 非法消息来源拒绝
//     if (clients.get(data.clientId) !== ws && clients.get(data.targetId) !== ws) {
//       ws.send(JSON.stringify({ type: "msg", clientId: "", targetId: "", message: "404" }))
//       return
//     }

//     if (data.type && data.clientId && data.message && data.targetId) {
//       // 优先处理绑定关系
//       const { clientId, targetId, message, type } = data
//       switch (data.type) {
//         case "bind":
//           // 服务器下发绑定关系
//           if (clients.has(clientId) && clients.has(targetId)) {
//             // relations的双方都不存在这俩id
//             if (
//               ![clientId, targetId].some(
//                 id => relations.has(id) || [...relations.values()].includes(id),
//               )
//             ) {
//               relations.set(clientId, targetId)
//               const client = clients.get(clientId)
//               const sendData = { clientId, targetId, message: "200", type: "bind" }
//               ws.send(JSON.stringify(sendData))
//               client.send(JSON.stringify(sendData))
//             } else {
//               const data = { type: "bind", clientId, targetId, message: "400" }
//               ws.send(JSON.stringify(data))
//               return
//             }
//           } else {
//             const sendData = { clientId, targetId, message: "401", type: "bind" }
//             ws.send(JSON.stringify(sendData))
//             return
//           }
//           break
//         case 1:
//         case 2:
//         case 3:
//           // 服务器下发APP强度调节
//           if (relations.get(clientId) !== targetId) {
//             const data = { type: "bind", clientId, targetId, message: "402" }
//             ws.send(JSON.stringify(data))
//             return
//           }
//           if (clients.has(targetId)) {
//             const client = clients.get(targetId)
//             const sendType = data.type - 1
//             const sendChannel = data.channel ? data.channel : 1
//             const sendStrength = data.type >= 3 ? data.strength : 1 //增加模式强度改成1
//             const msg = "strength-" + sendChannel + "+" + sendType + "+" + sendStrength
//             const sendData = { type: "msg", clientId, targetId, message: msg }
//             client.send(JSON.stringify(sendData))
//           }
//           break
//         case 4:
//           // 服务器下发指定APP强度
//           if (relations.get(clientId) !== targetId) {
//             const data = { type: "bind", clientId, targetId, message: "402" }
//             ws.send(JSON.stringify(data))
//             return
//           }
//           if (clients.has(targetId)) {
//             const client = clients.get(targetId)
//             const sendData = { type: "msg", clientId, targetId, message }
//             client.send(JSON.stringify(sendData))
//           }
//           break
//         case "clientMsg":
//           // 服务端下发给客户端的消息
//           if (relations.get(clientId) !== targetId) {
//             const data = { type: "bind", clientId, targetId, message: "402" }
//             ws.send(JSON.stringify(data))
//             return
//           }
//           if (!data.channel) {
//             // 240531.现在必须指定通道(允许一次只覆盖一个正在播放的波形)
//             const data = { type: "error", clientId, targetId, message: "406-channel is empty" }
//             ws.send(JSON.stringify(data))
//             return
//           }
//           if (clients.has(targetId)) {
//             //消息体 默认最少一个消息
//             let sendtime = data.time ? data.time : punishmentDuration // AB通道的执行时间
//             const target = clients.get(targetId) //发送目标
//             const sendData = { type: "msg", clientId, targetId, message: "pulse-" + data.message }
//             let totalSends = punishmentTime * sendtime
//             const timeSpace = 1000 / punishmentTime

//             if (clientTimers.has(clientId + "-" + data.channel)) {
//               // A通道计时器尚未工作完毕, 清除计时器且发送清除APP队列消息，延迟150ms重新发送新数据
//               // 新消息覆盖旧消息逻辑
//               console.log(
//                 "通道" +
//                   data.channel +
//                   "覆盖消息发送中，总消息数：" +
//                   totalSends +
//                   "持续时间A：" +
//                   sendtime,
//               )
//               ws.send("当前通道" + data.channel + "有正在发送的消息，覆盖之前的消息")

//               const timerId = clientTimers.get(clientId + "-" + data.channel)
//               clearInterval(timerId) // 清除定时器
//               clientTimers.delete(clientId + "-" + data.channel) // 清除 Map 中的对应项

//               // 发送APP波形队列清除指令
//               switch (data.channel) {
//                 case "A":
//                   const clearDataA = { clientId, targetId, message: "clear-1", type: "msg" }
//                   target.send(JSON.stringify(clearDataA))
//                   break

//                 case "B":
//                   const clearDataB = { clientId, targetId, message: "clear-2", type: "msg" }
//                   target.send(JSON.stringify(clearDataB))
//                   break
//                 default:
//                   break
//               }

//               setTimeout(() => {
//                 delaySendMsg(clientId, ws, target, sendData, totalSends, timeSpace, data.channel)
//               }, 150)
//             } else {
//               // 不存在未发完的消息 直接发送
//               delaySendMsg(clientId, ws, target, sendData, totalSends, timeSpace, data.channel)
//               console.log(
//                 "通道" +
//                   data.channel +
//                   "消息发送中，总消息数：" +
//                   totalSends +
//                   "持续时间：" +
//                   sendtime,
//               )
//             }
//           } else {
//             console.log(`未找到匹配的客户端，clientId: ${clientId}`)
//             const sendData = { clientId, targetId, message: "404", type: "msg" }
//             ws.send(JSON.stringify(sendData))
//           }
//           break
//         default:
//           // 未定义的普通消息
//           if (relations.get(clientId) !== targetId) {
//             const data = { type: "bind", clientId, targetId, message: "402" }
//             ws.send(JSON.stringify(data))
//             return
//           }
//           if (clients.has(clientId)) {
//             const client = clients.get(clientId)
//             const sendData = { type, clientId, targetId, message }
//             client.send(JSON.stringify(sendData))
//           } else {
//             // 未找到匹配的客户端
//             const sendData = { clientId, targetId, message: "404", type: "msg" }
//             ws.send(JSON.stringify(sendData))
//           }
//           break
//       }
//     }
//   })

//   ws.on("close", function close() {
//     // 连接关闭时，清除对应的 clientId 和 WebSocket 实例
//     console.log("WebSocket 连接已关闭")
//     // 遍历 clients Map，找到并删除对应的 clientId 条目
//     let clientId = ""
//     clients.forEach((value, key) => {
//       if (value === ws) {
//         // 拿到断开的客户端id
//         clientId = key
//       }
//     })
//     console.log("断开的client id:" + clientId)
//     relations.forEach((value, key) => {
//       if (key === clientId) {
//         //网页断开 通知app
//         let appid = relations.get(key)
//         let appClient = clients.get(appid)
//         const data = { type: "break", clientId, targetId: appid, message: "209" }
//         appClient.send(JSON.stringify(data))
//         appClient.close() // 关闭当前 WebSocket 连接
//         relations.delete(key) // 清除关系
//         console.log("对方掉线，关闭" + appid)
//       } else if (value === clientId) {
//         // app断开 通知网页
//         let webClient = clients.get(key)
//         const data = { type: "break", clientId: key, targetId: clientId, message: "209" }
//         webClient.send(JSON.stringify(data))
//         webClient.close() // 关闭当前 WebSocket 连接
//         relations.delete(key) // 清除关系
//         console.log("对方掉线，关闭" + clientId)
//       }
//     })
//     clients.delete(clientId) //清除ws客户端
//     console.log("已清除" + clientId + " ,当前size: " + clients.size)
//   })

//   ws.on("error", function (error) {
//     // 错误处理
//     console.error("WebSocket 异常:", error.message)
//     // 在此通知用户异常，通过 WebSocket 发送消息给双方
//     let clientId = ""
//     // 查找当前 WebSocket 实例对应的 clientId
//     for (const [key, value] of clients.entries()) {
//       if (value === ws) {
//         clientId = key
//         break
//       }
//     }
//     if (!clientId) {
//       console.error("无法找到对应的 clientId")
//       return
//     }
//     // 构造错误消息
//     const errorMessage = "WebSocket 异常: " + error.message

//     relations.forEach((value, key) => {
//       // 遍历关系 Map，找到并通知没掉线的那一方
//       if (key === clientId) {
//         // 通知app
//         let appid = relations.get(key)
//         let appClient = clients.get(appid)
//         const data = { type: "error", clientId: clientId, targetId: appid, message: "500" }
//         appClient.send(JSON.stringify(data))
//       }
//       if (value === clientId) {
//         // 通知网页
//         let webClient = clients.get(key)
//         const data = { type: "error", clientId: key, targetId: clientId, message: errorMessage }
//         webClient.send(JSON.stringify(data))
//       }
//     })
//   })

//   // 启动心跳定时器（如果尚未启动）
//   if (!heartbeatInterval) {
//     heartbeatInterval = setInterval(() => {
//       // 遍历 clients Map（大于0个链接），向每个客户端发送心跳消息
//       if (clients.size > 0) {
//         console.log(relations.size, clients.size, "发送心跳消息：" + new Date().toLocaleString())
//         clients.forEach((client, clientId) => {
//           heartbeatMsg.clientId = clientId
//           heartbeatMsg.targetId = relations.get(clientId) || ""
//           client.send(JSON.stringify(heartbeatMsg))
//         })
//       }
//     }, 60 * 1000) // 每分钟发送一次心跳消息
//   }
// })

// function delaySendMsg(clientId, client, target, sendData, totalSends, timeSpace, channel) {
//   // 发信计时器 通道会分别发送不同的消息和不同的数量 必须等全部发送完才会取消这个消息 新消息可以覆盖
//   target.send(JSON.stringify(sendData)) //立即发送一次通道的消息
//   totalSends--
//   if (totalSends > 0) {
//     return new Promise((resolve, reject) => {
//       // 按频率发送消息给特定的客户端
//       const timerId = setInterval(() => {
//         if (totalSends > 0) {
//           target.send(JSON.stringify(sendData))
//           totalSends--
//         }
//         // 如果达到发送次数上限，则停止定时器
//         if (totalSends <= 0) {
//           clearInterval(timerId)
//           client.send("发送完毕")
//           clientTimers.delete(clientId) // 删除对应的定时器
//           resolve()
//         }
//       }, timeSpace) // 每隔频率倒数触发一次定时器

//       // 存储clientId与其对应的timerId和通道
//       clientTimers.set(clientId + "-" + channel, timerId)
//     })
//   }
// }


import WebSocket, { WebSocketServer } from "ws"
import { v4 as uuidv4 } from "uuid"

// 配置常量
const CONFIG = {
  PORT: 4562,
  HEARTBEAT_INTERVAL: 60000, // 60秒
  DEFAULT_PUNISHMENT_DURATION: 5, // 默认发送持续时间5秒
  DEFAULT_PUNISHMENT_RATE: 1, // 默认每秒发送1次
  MESSAGE_OVERRIDE_DELAY: 150, // 消息覆盖延迟150ms
}

// 错误码定义
const ERROR_CODES = {
  INVALID_JSON: "403",
  NOT_FOUND: "404",
  CLIENT_NOT_FOUND: "401",
  RELATION_NOT_BOUND: "402",
  ALREADY_BOUND: "400",
  CHANNEL_EMPTY: "406",
  WEBSOCKET_ERROR: "500",
  CONNECTION_BREAK: "209",
  SUCCESS: "200",
}

// 客户端管理类
class ClientManager {
  constructor() {
    this.clients = new Map() // clientId -> WebSocket
    this.relations = new Map() // clientId -> targetId (一对一绑定关系)
    this.clientTimers = new Map() // clientId-channel -> timerId
  }

  addClient(clientId, ws) {
    this.clients.set(clientId, ws)
  }

  removeClient(clientId) {
    this.clients.delete(clientId)
    // 清理相关的定时器
    const timersToDelete = []
    for (const key of this.clientTimers.keys()) {
      if (key.startsWith(clientId + "-")) {
        clearInterval(this.clientTimers.get(key))
        timersToDelete.push(key)
      }
    }
    timersToDelete.forEach(key => this.clientTimers.delete(key))
  }

  getClient(clientId) {
    return this.clients.get(clientId)
  }

  hasClient(clientId) {
    return this.clients.has(clientId)
  }

  createRelation(clientId, targetId) {
    // 检查是否已存在绑定关系
    if (this.isClientBound(clientId) || this.isClientBound(targetId)) {
      return false
    }
    this.relations.set(clientId, targetId)
    return true
  }

  removeRelation(clientId) {
    this.relations.delete(clientId)
  }

  getTarget(clientId) {
    return this.relations.get(clientId)
  }

  isClientBound(clientId) {
    return this.relations.has(clientId) || [...this.relations.values()].includes(clientId)
  }

  isValidRelation(clientId, targetId) {
    return this.relations.get(clientId) === targetId
  }

  findClientIdByWs(ws) {
    for (const [clientId, client] of this.clients.entries()) {
      if (client === ws) {
        return clientId
      }
    }
    return null
  }

  getAllClients() {
    return this.clients
  }

  getRelations() {
    return this.relations
  }

  setTimer(key, timerId) {
    this.clientTimers.set(key, timerId)
  }

  clearTimer(key) {
    if (this.clientTimers.has(key)) {
      clearInterval(this.clientTimers.get(key))
      this.clientTimers.delete(key)
    }
  }

  hasTimer(key) {
    return this.clientTimers.has(key)
  }
}

// 消息处理类
class MessageHandler {
  constructor(clientManager) {
    this.clientManager = clientManager
  }

  createMessage(type, clientId, targetId, message) {
    return JSON.stringify({ type, clientId, targetId, message })
  }

  sendError(ws, type, clientId, targetId, errorCode) {
    const message = this.createMessage(type, clientId, targetId, errorCode)
    ws.send(message)
  }

  handleBind(ws, data) {
    const { clientId, targetId } = data
    
    if (!this.clientManager.hasClient(clientId) || !this.clientManager.hasClient(targetId)) {
      this.sendError(ws, "bind", clientId, targetId, ERROR_CODES.CLIENT_NOT_FOUND)
      return
    }

    if (!this.clientManager.createRelation(clientId, targetId)) {
      this.sendError(ws, "bind", clientId, targetId, ERROR_CODES.ALREADY_BOUND)
      return
    }

    const successMessage = this.createMessage("bind", clientId, targetId, ERROR_CODES.SUCCESS)
    ws.send(successMessage)
    this.clientManager.getClient(clientId).send(successMessage)
  }

  handleStrengthControl(ws, data) {
    const { clientId, targetId, type, channel = 1, strength } = data

    if (!this.clientManager.isValidRelation(clientId, targetId)) {
      this.sendError(ws, "bind", clientId, targetId, ERROR_CODES.RELATION_NOT_BOUND)
      return
    }

    const targetClient = this.clientManager.getClient(targetId)
    if (!targetClient) return

    const sendType = type - 1
    const sendStrength = type >= 3 ? strength : 1
    const message = `strength-${channel}+${sendType}+${sendStrength}`
    
    targetClient.send(this.createMessage("msg", clientId, targetId, message))
  }

  handleDirectMessage(ws, data) {
    const { clientId, targetId, message } = data

    if (!this.clientManager.isValidRelation(clientId, targetId)) {
      this.sendError(ws, "bind", clientId, targetId, ERROR_CODES.RELATION_NOT_BOUND)
      return
    }

    const targetClient = this.clientManager.getClient(targetId)
    if (targetClient) {
      targetClient.send(this.createMessage("msg", clientId, targetId, message))
    }
  }

  async handleClientMessage(ws, data) {
    const { clientId, targetId, channel, message, time = CONFIG.DEFAULT_PUNISHMENT_DURATION } = data

    if (!this.clientManager.isValidRelation(clientId, targetId)) {
      this.sendError(ws, "bind", clientId, targetId, ERROR_CODES.RELATION_NOT_BOUND)
      return
    }

    if (!channel) {
      this.sendError(ws, "error", clientId, targetId, ERROR_CODES.CHANNEL_EMPTY + "-channel is empty")
      return
    }

    const targetClient = this.clientManager.getClient(targetId)
    if (!targetClient) {
      this.sendError(ws, "msg", clientId, targetId, ERROR_CODES.NOT_FOUND)
      return
    }

    await this.sendPulseMessage(ws, clientId, targetClient, message, time, channel)
  }

  async sendPulseMessage(ws, clientId, targetClient, message, duration, channel) {
    const timerKey = `${clientId}-${channel}`
    const totalSends = CONFIG.DEFAULT_PUNISHMENT_RATE * duration
    const timeInterval = 1000 / CONFIG.DEFAULT_PUNISHMENT_RATE
    const pulseMessage = this.createMessage("msg", clientId, "", `pulse-${message}`)

    // 如果该通道已有正在发送的消息，先清除
    if (this.clientManager.hasTimer(timerKey)) {
      console.log(`通道${channel}覆盖消息发送中，总消息数：${totalSends}，持续时间：${duration}`)
      ws.send(`当前通道${channel}有正在发送的消息，覆盖之前的消息`)
      
      this.clientManager.clearTimer(timerKey)
      
      // 发送清除队列指令
      const clearMessage = channel === "A" ? "clear-1" : "clear-2"
      targetClient.send(this.createMessage("msg", clientId, "", clearMessage))
      
      // 延迟重新发送
      setTimeout(() => {
        this.executePulseSequence(ws, clientId, targetClient, pulseMessage, totalSends, timeInterval, timerKey)
      }, CONFIG.MESSAGE_OVERRIDE_DELAY)
    } else {
      console.log(`通道${channel}消息发送中，总消息数：${totalSends}，持续时间：${duration}`)
      this.executePulseSequence(ws, clientId, targetClient, pulseMessage, totalSends, timeInterval, timerKey)
    }
  }

  executePulseSequence(ws, clientId, targetClient, message, totalSends, timeInterval, timerKey) {
    // 立即发送第一条消息
    targetClient.send(message)
    let remainingSends = totalSends - 1

    if (remainingSends <= 0) {
      ws.send("发送完毕")
      return
    }

    const timerId = setInterval(() => {
      if (remainingSends > 0) {
        targetClient.send(message)
        remainingSends--
      }

      if (remainingSends <= 0) {
        clearInterval(timerId)
        this.clientManager.clientTimers.delete(timerKey)
        ws.send("发送完毕")
      }
    }, timeInterval)

    this.clientManager.setTimer(timerKey, timerId)
  }

  handleDefaultMessage(ws, data) {
    const { type, clientId, targetId, message } = data

    if (!this.clientManager.isValidRelation(clientId, targetId)) {
      this.sendError(ws, "bind", clientId, targetId, ERROR_CODES.RELATION_NOT_BOUND)
      return
    }

    const targetClient = this.clientManager.getClient(clientId)
    if (targetClient) {
      targetClient.send(this.createMessage(type, clientId, targetId, message))
    } else {
      this.sendError(ws, "msg", clientId, targetId, ERROR_CODES.NOT_FOUND)
    }
  }
}

// 心跳管理类
class HeartbeatManager {
  constructor(clientManager) {
    this.clientManager = clientManager
    this.heartbeatInterval = null
  }

  start() {
    if (!this.heartbeatInterval) {
      this.heartbeatInterval = setInterval(() => {
        const clients = this.clientManager.getAllClients()
        const relations = this.clientManager.getRelations()
        
        if (clients.size > 0) {
          console.log(`${relations.size}, ${clients.size}, 发送心跳消息：${new Date().toLocaleString()}`)
          
          clients.forEach((client, clientId) => {
            const heartbeatMsg = {
              type: "heartbeat",
              clientId: clientId,
              targetId: this.clientManager.getTarget(clientId) || "",
              message: ERROR_CODES.SUCCESS,
            }
            client.send(JSON.stringify(heartbeatMsg))
          })
        }
      }, CONFIG.HEARTBEAT_INTERVAL)
    }
  }

  stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }
}

// 主服务器类
export class WebSocketServerManager {
  constructor() {
    this.clientManager = new ClientManager()
    this.messageHandler = new MessageHandler(this.clientManager)
    this.heartbeatManager = new HeartbeatManager(this.clientManager)
    this.wss = new WebSocketServer({ port: CONFIG.PORT })
    
    this.setupServer()
  }

  setupServer() {
    this.wss.on("connection", (ws) => {
      this.handleConnection(ws)
    })
    
    console.log(`WebSocket服务器已启动，监听端口：${CONFIG.PORT}`)
  }

  handleConnection(ws) {
    let clientId = uuidv4()
    console.log("新的WebSocket连接已建立，标识符为:", clientId)

    this.clientManager.addClient(clientId, ws)
    
    // 发送绑定消息
    ws.send(JSON.stringify({ 
      type: "bind", 
      clientId, 
      message: "targetId", 
      targetId: "" 
    }))

    // 设置消息监听器
    ws.on("message", (message) => {
      this.handleMessage(ws, message, clientId)
    })

    // 设置关闭监听器
    ws.on("close", () => {
      this.handleClose(ws, clientId)
    })

    // 设置错误监听器
    ws.on("error", (error) => {
      this.handleError(ws, error, clientId)
    })

    // 启动心跳（如果尚未启动）
    this.heartbeatManager.start()
  }

  handleMessage(ws, message, clientId) {
    console.log("收到消息：" + message)
    
    let data
    try {
      data = JSON.parse(message)
    } catch (e) {
      this.messageHandler.sendError(ws, "msg", "", "", ERROR_CODES.INVALID_JSON)
      return
    }

    // 处理UUID更新
    if (data.type === "uuid") {
      this.clientManager.addClient(data.uuid, ws)
      this.clientManager.removeClient(clientId)
      clientId = data.uuid
      return
    }

    // 验证消息来源
    if (!this.isValidMessageSource(ws, data)) {
      this.messageHandler.sendError(ws, "msg", "", "", ERROR_CODES.NOT_FOUND)
      return
    }

    // 验证消息格式
    if (!this.isValidMessageFormat(data)) {
      return
    }

    this.routeMessage(ws, data)
  }

  isValidMessageSource(ws, data) {
    const clientWs = this.clientManager.getClient(data.clientId)
    const targetWs = this.clientManager.getClient(data.targetId)
    return clientWs === ws || targetWs === ws
  }

  isValidMessageFormat(data) {
    return data.type && data.clientId && data.message && data.targetId
  }

  routeMessage(ws, data) {
    switch (data.type) {
      case "bind":
        this.messageHandler.handleBind(ws, data)
        break
      case 1:
      case 2:
      case 3:
        this.messageHandler.handleStrengthControl(ws, data)
        break
      case 4:
        this.messageHandler.handleDirectMessage(ws, data)
        break
      case "clientMsg":
        this.messageHandler.handleClientMessage(ws, data)
        break
      default:
        this.messageHandler.handleDefaultMessage(ws, data)
        break
    }
  }

  handleClose(ws, clientId) {
    console.log("WebSocket连接已关闭")
    
    const actualClientId = this.clientManager.findClientIdByWs(ws)
    if (actualClientId) {
      console.log("断开的client id:" + actualClientId)
      this.notifyRelatedClients(actualClientId, "break", ERROR_CODES.CONNECTION_BREAK)
      this.clientManager.removeClient(actualClientId)
      console.log(`已清除${actualClientId}，当前size: ${this.clientManager.getAllClients().size}`)
    }
  }

  handleError(ws, error, clientId) {
    console.error("WebSocket异常:", error.message)
    
    const actualClientId = this.clientManager.findClientIdByWs(ws)
    if (actualClientId) {
      this.notifyRelatedClients(actualClientId, "error", ERROR_CODES.WEBSOCKET_ERROR)
    }
  }

  notifyRelatedClients(clientId, type, message) {
    const relations = this.clientManager.getRelations()
    
    relations.forEach((targetId, relatedClientId) => {
      if (relatedClientId === clientId) {
        // 通知目标客户端
        const targetClient = this.clientManager.getClient(targetId)
        if (targetClient) {
          const data = { type, clientId, targetId, message }
          targetClient.send(JSON.stringify(data))
          targetClient.close()
          this.clientManager.removeRelation(relatedClientId)
          console.log(`对方掉线，关闭${targetId}`)
        }
      } else if (targetId === clientId) {
        // 通知关联客户端
        const relatedClient = this.clientManager.getClient(relatedClientId)
        if (relatedClient) {
          const data = { type, clientId: relatedClientId, targetId: clientId, message }
          relatedClient.send(JSON.stringify(data))
          relatedClient.close()
          this.clientManager.removeRelation(relatedClientId)
          console.log(`对方掉线，关闭${clientId}`)
        }
      }
    })
  }
}

// const server = new WebSocketServerManager()

// process.on('SIGINT', () => {
//   server.heartbeatManager.stop()
//   server.wss.close(() => {
//     process.exit(0)
//   })
// })