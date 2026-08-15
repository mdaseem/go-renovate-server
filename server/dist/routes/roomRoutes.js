"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const messageModel_1 = __importDefault(require("../models/messageModel"));
const router = express_1.default.Router();
// GET messages of a room, newest page first (paginated via ?limit=&before=)
router.get("/:roomId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { roomId } = req.params;
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
        const query = { roomId };
        if (req.query.before) {
            const before = new Date(req.query.before);
            if (!isNaN(before.getTime())) {
                query.createdAt = { $lt: before };
            }
        }
        const page = yield messageModel_1.default.find(query)
            .sort({ createdAt: -1 })
            .limit(limit);
        const messages = page.reverse();
        return res.status(200).json({
            success: true,
            messages,
            hasMore: page.length === limit,
        });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch messages",
        });
    }
}));
exports.default = router;
