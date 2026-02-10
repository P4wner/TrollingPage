const express = require('express')
const WebSocket = require('ws')
const { Telegraf } = require('telegraf')
const path = require('path')

const app = express()
const port = process.env.PORT || 3000

const botToken = process.env.BOT_TOKEN
const chatId = process.env.CHAT_ID

if (!botToken || !chatId) {
  console.log('Missing BOT_TOKEN or CHAT_ID')
  process.exit(1)
}

const bot = new Telegraf(botToken)

let activeClients = new Map()
let clientIdCounter = 0

const wss = new WebSocket.Server({ noServer: true })

app.use(express.static('public'))

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

app.get('/notify', (req, res) => {
  const user = req.query.user || 'Someone'
  const now = new Date()
  const date = now.toLocaleDateString()
  const time = now.toLocaleTimeString()
  const message = `${user} Is on Website at ${date} ${time}`

  bot.telegram.sendMessage(chatId, message, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🎵', callback_data: 'play' },
          { text: '☠️', callback_data: 'skull' },
          { text: '📥', callback_data: 'download' },
          { text: '😈', callback_data: 'all' }
        ]
      ]
    }
  }).catch(() => {})

  res.json({ status: 'ok' })
})

const server = app.listen(port, async () => {
  console.log(`Running on port ${port}`)

  const webhookUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_STATIC_URL || 'your-domain.up.railway.app'}/webhook`

  await bot.telegram.setWebhook(webhookUrl)
  console.log(`Webhook set to: ${webhookUrl}`)
})

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request)
  })
})

wss.on('connection', (ws) => {
  const id = clientIdCounter++
  activeClients.set(id, ws)

  ws.on('close', () => {
    activeClients.delete(id)
  })

  ws.on('error', () => {
    activeClients.delete(id)
  })
})

bot.on('callback_query', (ctx) => {
  const action = ctx.callbackQuery.data
  const cid = ctx.chat.id.toString()

  if (cid !== chatId) return

  for (const [id, ws] of activeClients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action }))
    }
  }

  ctx.answerCbQuery()
})

app.use(bot.webhookCallback('/webhook'))
