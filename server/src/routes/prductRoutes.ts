import express, { Request, Response, Router } from "express";
import { Products } from "../models/productModel";

const router: Router = express.Router();
router.get("/", async (req: Request, res: Response) => {
  const products = await Products.find({});
  
  res.json(products);
});

export default router;
