import { Telegraf, Markup } from "telegraf";
import express from "express";

const token = process.env.TOKEN;

// Canal y admin
const CANAL = "-1003911152750";
const ADMIN_ID = 8392355708;

const bot = new Telegraf(token);
const app = express();
app.use(express.json());

let estado = {};

// Middleware para admin
bot.use((ctx, next) => {
  if (ctx.from?.id !== ADMIN_ID) {
    return ctx.reply("❌ No autorizado");
  }
  return next();
});

// Comando /post
bot.command("post", async (ctx) => {
  estado[ctx.chat.id] = { step: 1 };
  await ctx.reply("📌 Copia el mensaje que quieres publicar");
});

// Recepción de mensajes
bot.on("message", async (ctx) => {
  const user = estado[ctx.chat.id];
  if (!user) return;

  if (user.step === 1 && (ctx.message.text || ctx.message.photo || ctx.message.document || ctx.message.video)) {
    user.original_chat = ctx.chat.id;
    user.original_message_id = ctx.message.message_id;
    user.step = 2;
    return ctx.reply("🔗 Envía el link principal para el botón Descargar aquí");
  }

  if (user.step === 2 && ctx.message.text) {
    user.link = ctx.message.text;
    user.guia = "https://t.me/nrcmod/154";
    user.comentarios = "https://t.me/nrcmods";
    user.step = 3;

    // Preview con botones de color
    await ctx.copyMessage(ctx.chat.id, user.original_chat, user.original_message_id, {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.url("🔗 Descargar aquí", user.link).style("success")],
        [
          Markup.button.url("📘 Ayuda", user.guia).style("primary"),
          Markup.button.url("💬 Comentar", user.comentarios).style("primary")
        ],
        [
          Markup.button.callback("✅ Publicar", "publicar").style("success"),
          Markup.button.callback("❌ Cancelar", "cancelar").style("danger")
        ]
      ])
    });

    await ctx.reply("👆 Vista previa. Confirma:");
  }
});

// Manejo de botones callback
bot.on("callback_query", async (ctx) => {
  const query = ctx.callbackQuery;
  const chatId = ctx.chat.id;
  const user = estado[chatId];
  if (!user) return;

  if (query.data === "publicar") {
    try {
      await ctx.telegram.copyMessage(CANAL, user.original_chat, user.original_message_id, {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.url("🔗 Descargar aquí", user.link).style("success")],
          [
            Markup.button.url("📘 Ayuda", user.guia).style("primary"),
            Markup.button.url("💬 Comentar", user.comentarios).style("primary")
          ]
        ])
      });

      await ctx.answerCbQuery("Publicado ✅");
      await ctx.reply("✅ Publicado en el canal");

      // Borrar preview
      await ctx.deleteMessage();

    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery("Error ❌", { show_alert: true });
    }

    delete estado[chatId];
  }

  if (query.data === "cancelar") {
    delete estado[chatId];
    await ctx.answerCbQuery("Cancelado ❌");
    await ctx.reply("❌ Post cancelado");
    await ctx.deleteMessage();
  }
});

// Servidor para webhook
const PORT = process.env.PORT || 3000;
app.post(`/bot${token}`, (req, res) => {
  bot.handleUpdate(req.body);
  res.sendStatus(200);
});

app.listen(PORT, async () => {
  console.log("Servidor iniciado");
  const url = process.env.RENDER_EXTERNAL_URL;
  await bot.telegram.setWebhook(`${url}/bot${token}`);
});
