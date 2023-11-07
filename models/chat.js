const { EntitySchema } = require("typeorm");
const Invoice = require("./invoice");

const Chat = new EntitySchema({
  name: "Chat",
  columns: {
    id: {
      generated: true,
      type: "int",
      primary: true,
    },
    telegram_chat_id: {
      unique: true,
      type: "varchar",
    },
  },
  relations: {
    invoices: {
      target: "Invoice",
      type: "one-to-many",
      inverseSide: "chats",
      cascade: true,
      onDelete: "cascade",
    },
  },
});

module.exports = Chat;
