@echo off
REM Opens your Zenvy bot's Telegram chat in the Telegram app (or browser fallback).
REM EDIT THIS to match your bot username from @BotFather (without the leading @):
set BOT_USERNAME=YourBotUsername

start "" "https://t.me/%BOT_USERNAME%"
