import express from "express";
import { Telegraf, Markup } from "telegraf";
import fs from "fs";

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

// ID группы, куда бот будет выдавать приглашения
// Пример: const GROUP_ID = -1001234567890;
const GROUP_ID = Number(process.env.GROUP_ID);

// Храним последнюю ссылку
const dataFile = "group.json";
if (!fs.existsSync(dataFile)) {
  fs.writeFileSync(dataFile, JSON.stringify({ lastInvite: null }, null, 2));
}

function setLastInvite(link) {
  fs.writeFileSync(dataFile, JSON.stringify({ lastInvite: link }, null, 2));
}

function getLastInvite() {
  try {
    return JSON.parse(fs.readFileSync(dataFile)).lastInvite;
  } catch {
    return null;
  }
}

// Авто-генерация новой ссылки
async function generateInviteLink() {
  try {
    const newLink = await bot.telegram.createChatInviteLink(GROUP_ID, {
      expire_date: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 часа
      member_limit: 1,
    });

    setLastInvite(newLink.invite_link);
    return newLink.invite_link;
  } catch (err) {
    console.error("Ошибка создания ссылки:", err);
    return "_Бот не смог создать ссылку. Дайте ему права админа._";
  }
}

// -------- СТАРТ --------
bot.start(async (ctx) => {
  const photo = process.env.PHOTO_ID;;

  await ctx.replyWithPhoto(photo, {
    caption:
      "*Здравствуйте!*\n\n_Подайте анкету и получите ссылку в нашу команду \"Molynew Team\"._\n\nПо вопросам: @MolynewSupportBot",
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard([[Markup.button.callback("Начать 📝", "start_survey")]]),
  });
});

// Состояние пользователей
const userState = {};

// -------- ВОПРОС №1 --------
bot.action("start_survey", async (ctx) => {
  await ctx.editMessageCaption(
    "*Анкета*\n\n_Согласны ли вы работать в формате 60/40?_",
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("Да ✅", "agree_yes")],
        [Markup.button.callback("Нет ❌", "agree_no")],
      ]),
    }
  );
});

bot.action("agree_no", async (ctx) => {
  await ctx.editMessageCaption("*Заявка отклонена.*", { parse_mode: "Markdown" });
});

// -------- ВОПРОС №2 --------
bot.action("agree_yes", async (ctx) => {
  userState[ctx.from.id] = {};
  await ctx.editMessageCaption(
    "*Анкета*\n\n_Есть ли у вас опыт работы в онлайн-сфере?_",
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("Да ✅", "exp_yes")],
        [Markup.button.callback("Нет ❌", "exp_no")],
      ]),
    }
  );
});

// Если нет опыта — сразу проход
bot.action("exp_no", async (ctx) => {
  const link = await generateInviteLink();

  await ctx.editMessageCaption(
    `*Ваша анкета одобрена!* 🎉\n\nВаша ссылка:\n${link}`,
    { parse_mode: "Markdown" }
  );

  await sendMainMenu(ctx);
});

// -------- ВОПРОС №3 --------
bot.action("exp_yes", async (ctx) => {
  await ctx.editMessageCaption(
    "*Анкета*\n\n_В какой сфере у вас был опыт?_",
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("Дрейнер 🎨", "work_design")],
        [Markup.button.callback("Стиллер 📢", "work_marketing")],
        [Markup.button.callback("ОТС 💻", "work_dev")],
        [Markup.button.callback("Другое ✏️", "work_other")],
      ]),
    }
  );
});

const workTypes = ["design", "marketing", "dev"];

workTypes.forEach((type) => {
  bot.action(`work_${type}`, async (ctx) => {
    const link = await generateInviteLink();

    await ctx.editMessageCaption(
      `*Ваша анкета одобрена!* 🎉\n\nВаша ссылка:\n${link}`,
      { parse_mode: "Markdown" }
    );

    await sendMainMenu(ctx);
  });
});

// Другое → ввод текста
bot.action("work_other", async (ctx) => {
  userState[ctx.from.id].awaitingCustom = true;

  await ctx.editMessageCaption(
    "*Анкета*\n\n_Напишите свой вариант опыта:_",
    { parse_mode: "Markdown" }
  );
});

bot.on("text", async (ctx) => {
  if (userState[ctx.from.id]?.awaitingCustom) {
    userState[ctx.from.id].awaitingCustom = false;

    const link = await generateInviteLink();

    await ctx.replyWithMarkdown(
      `*Ваша анкета одобрена!* 🎉\n\nВаша ссылка:\n${link}`
    );

    await sendMainMenu(ctx);
  }
});

// -------- МЕНЮ --------
async function sendMainMenu(ctx) {
  const photo = process.env.PHOTO_ID;

  await ctx.replyWithPhoto(photo, {
    caption:
      "*Главное меню*\n\n_Полезные боты и ресурсы:_",
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard([
      [Markup.button.url("Gift Castle 🎁", "https://t.me/Giftcastlebot")],
      [Markup.button.url("Castle Выплаты 💸", "https://t.me/GiftCastlepayments")],
      [Markup.button.url("Castle Мануалы 📚", "https://t.me/GiftCastleManuals")],
    ]),
  });
}

// --- Render ---
app.get("/", (req, res) => res.send("Bot is running"));
app.listen(3000);

bot.launch();
