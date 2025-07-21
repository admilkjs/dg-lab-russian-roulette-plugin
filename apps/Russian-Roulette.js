import plugin from "../../../lib/plugins/plugin.js"
import { Connections } from "../lib/dg/Connections.js"
/**
 * @type {Map<number, RouletteGame>}
 */
const gameInstances = new Map()

export class Roulette extends plugin {
  constructor() {
    super({
      name: "[郊狼轮盘赌] 轮盘赌",
      dsc: "你中大奖了",
      event: "message",
      priority: 0,
      rule: [
        {
          reg: "^#开枪$",
          fnc: "shoot",
        },
        {
          reg: "^#加入轮盘赌$",
          fnc: "joinGame",
        },
        {
          reg: "^#退出轮盘赌$",
          fnc: "leaveGame",
        },
        {
          reg: "^#轮盘赌状态$",
          fnc: "gameStatus",
        },
        {
          reg: "^#重置轮盘赌$",
          fnc: "resetGame",
        },
      ],
    })
  }

  /**
   * 加入轮盘赌游戏
   */
  async joinGame(e) {
    if (!Connections.get(e.user_id)) {
      return await e.reply("你还未绑定设备,请先发送#绑定郊狼")
    }

    const game = this.getOrCreateGame(e.group_id)
    const result = game.addPlayer(e.user_id)

    switch (result) {
      case "SUCCESS":
        await e.reply(`你已成功加入轮盘赌游戏,当前玩家数量: ${game.getPlayerCount()}`)
        break
      case "ALREADY_IN":
        await e.reply("你已经在游戏中了")
        break
      case "ALREADY_DEAD":
        await e.reply("你已经死亡，无法重新加入当前游戏")
        break
    }
  }

  /**
   * 退出轮盘赌游戏
   */
  async leaveGame(e) {
    const game = gameInstances.get(e.group_id)
    if (!game) {
      return await e.reply("当前群组没有进行中的轮盘赌游戏")
    }

    const result = game.removePlayer(e.user_id)
    if (result) {
      await e.reply(`你已退出轮盘赌游戏,当前玩家数量: ${game.getPlayerCount()}`)

      // 如果没有玩家了，清理游戏
      if (game.getPlayerCount() === 0) {
        gameInstances.delete(e.group_id)
        await e.reply("所有玩家已退出，游戏结束")
      }
    } else {
      await e.reply("你不在当前游戏中")
    }
  }

  /**
   * 开枪
   */
  async shoot(e) {
    const game = this.getOrCreateGame(e.group_id)

    // 如果玩家不在游戏中，自动加入
    if (!game.hasPlayer(e.user_id)) {
      if (!Connections.get(e.user_id)) {
        return await e.reply("你还未绑定设备,请先发送#绑定郊狼")
      }
      game.addPlayer(e.user_id)
      await e.reply(`你已自动加入轮盘赌游戏,当前玩家数量: ${game.getPlayerCount()}`)
    }

    const result = game.shoot(e.user_id)

    switch (result.status) {
      case "NO_BULLETS":
        await e.reply("没有子弹了,游戏结束。发送 #加入轮盘赌 开始新游戏")
        break
      case "PLAYER_DEAD":
        await e.reply("你已经死亡，无法继续游戏")
        break
      case "HIT":
        await e.reply(
          `砰! 你被击中了！剩余子弹: ${result.remainingBullets}, 剩余真子弹: ${result.realBullets}`,
        )
        Connections.get(e.user_id).发送波形消息(
          "A",
          JSON.stringify(
            解析波形数据([
              [
                [10, 10, 10, 10],
                [100, 100, 100, 100],
              ],
              [
                [10, 10, 10, 10],
                [100, 100, 100, 100],
              ],
              [
                [10, 10, 10, 10],
                [100, 100, 100, 100],
              ],
              [
                [10, 10, 10, 10],
                [0, 0, 0, 0],
              ],
              [
                [10, 10, 10, 10],
                [0, 0, 0, 0],
              ],
              [
                [10, 10, 10, 10],
                [0, 0, 0, 0],
              ],
              [
                [10, 10, 10, 10],
                [0, 0, 0, 0],
              ],
              [
                [110, 110, 110, 110],
                [100, 100, 100, 100],
              ],
              [
                [110, 110, 110, 110],
                [100, 100, 100, 100],
              ],
              [
                [110, 110, 110, 110],
                [100, 100, 100, 100],
              ],
              [
                [110, 110, 110, 110],
                [100, 100, 100, 100],
              ],
              [
                [0, 0, 0, 0],
                [0, 0, 0, 0],
              ],
            ]),
          ),
          2,
        )
        if (result.gameEnded) {
          await e.reply("所有真子弹已用完，游戏结束！")
        }
        break
      case "SAFE":
        await e.reply(
          `咔! 你安全了，请继续。剩余子弹: ${result.remainingBullets}, 剩余真子弹: ${result.realBullets}`,
        )
        break
      case "WINNER":
        await e.reply(`恭喜你！你是最后的幸存者，赢得了游戏！`)
        break
    }
  }

  /**
   * 查看游戏状态
   */
  async gameStatus(e) {
    const game = gameInstances.get(e.group_id)
    if (!game) {
      return await e.reply("当前群组没有进行中的轮盘赌游戏")
    }

    const status = game.getGameStatus()
    const statusMsg = [
      `=== 轮盘赌游戏状态 ===`,
      `总玩家数: ${status.totalPlayers}`,
      `存活玩家数: ${status.alivePlayers}`,
      `死亡玩家数: ${status.deadPlayers}`,
      `剩余子弹: ${status.remainingBullets}`,
      `剩余真子弹: ${status.realBullets}`,
      `中奖概率: ${(status.hitProbability * 100).toFixed(1)}%`,
    ]

    await e.reply(statusMsg.join("\n"))
  }

  /**
   * 重置游戏
   */
  async resetGame(e) {
    gameInstances.delete(e.group_id)
    await e.reply("轮盘赌游戏已重置")
  }

  /**
   * 获取或创建游戏实例
   */
  getOrCreateGame(groupId) {
    if (!gameInstances.has(groupId)) {
      gameInstances.set(groupId, new RouletteGame(groupId))
    }
    return gameInstances.get(groupId)
  }
}

/**
 * 轮盘赌游戏逻辑类
 */
class RouletteGame {
  constructor(groupId) {
    this.groupId = groupId
    this.players = new Map() // userId -> { dead: boolean, shots: number }
    this.totalBullets = 6
    this.realBullets = 1
    this.gameStarted = false
  }

  /**
   * 添加玩家
   */
  addPlayer(userId) {
    if (this.players.has(userId)) {
      const player = this.players.get(userId)
      if (player.dead) {
        return "ALREADY_DEAD"
      }
      return "ALREADY_IN"
    }

    this.players.set(userId, {
      dead: false,
      shots: 0,
    })

    if (!this.gameStarted) {
      this.gameStarted = true
    }

    return "SUCCESS"
  }

  /**
   * 移除玩家
   */
  removePlayer(userId) {
    return this.players.delete(userId)
  }

  /**
   * 检查玩家是否在游戏中
   */
  hasPlayer(userId) {
    return this.players.has(userId)
  }

  /**
   * 获取玩家数量
   */
  getPlayerCount() {
    return this.players.size
  }

  /**
   * 获取存活玩家数量
   */
  getAlivePlayerCount() {
    let count = 0
    for (const player of this.players.values()) {
      if (!player.dead) count++
    }
    return count
  }

  /**
   * 开枪逻辑
   */
  shoot(userId) {
    // 检查是否还有子弹
    if (this.totalBullets <= 0) {
      return { status: "NO_BULLETS" }
    }

    const player = this.players.get(userId)
    if (!player) {
      return { status: "NO_PLAYER" }
    }

    if (player.dead) {
      return { status: "PLAYER_DEAD" }
    }

    // 计算命中概率
    const hitProbability = this.realBullets / this.totalBullets
    const isHit = Math.random() < hitProbability

    // 消耗一发子弹
    this.totalBullets--
    player.shots++

    const result = {
      remainingBullets: this.totalBullets,
      realBullets: this.realBullets,
      gameEnded: false,
    }

    if (isHit) {
      // 击中，玩家死亡
      player.dead = true
      this.realBullets--
      result.status = "HIT"

      // 检查游戏是否结束
      if (this.realBullets <= 0) {
        result.gameEnded = true
        this.endGame()
      } else if (this.getAlivePlayerCount() === 1) {
        result.status = "WINNER"
        this.endGame()
      }
    } else {
      // 安全
      result.status = "SAFE"

      // 检查是否只剩真子弹
      if (this.totalBullets === this.realBullets && this.getAlivePlayerCount() === 1) {
        result.status = "WINNER"
        this.endGame()
      }
    }

    return result
  }

  /**
   * 获取游戏状态
   */
  getGameStatus() {
    const aliveCount = this.getAlivePlayerCount()
    const deadCount = this.players.size - aliveCount
    const hitProbability = this.totalBullets > 0 ? this.realBullets / this.totalBullets : 0

    return {
      totalPlayers: this.players.size,
      alivePlayers: aliveCount,
      deadPlayers: deadCount,
      remainingBullets: this.totalBullets,
      realBullets: this.realBullets,
      hitProbability: hitProbability,
    }
  }

  /**
   * 结束游戏
   */
  endGame() {
    gameInstances.delete(this.groupId)
  }
}
