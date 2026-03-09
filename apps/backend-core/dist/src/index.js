"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const auth_1 = __importDefault(require("./routes/auth"));
const challenges_1 = __importDefault(require("./routes/challenges"));
const logs_1 = __importDefault(require("./routes/logs"));
const quests_1 = __importDefault(require("./routes/quests"));
const users_1 = __importDefault(require("./routes/users"));
const app = (0, express_1.default)();
const port = process.env.PORT || 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});
// API Routes
app.use('/api/auth', auth_1.default);
app.use('/api/challenges', challenges_1.default);
app.use('/api/logs', logs_1.default);
app.use('/api/quests', quests_1.default);
app.use('/api/users', users_1.default);
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
