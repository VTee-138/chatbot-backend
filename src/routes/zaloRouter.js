const { Router } = require("express");
const zaloController = require("../controllers/zaloController");

const zaloRouter = Router()
zaloRouter.get('/getUsers', zaloController.getUsers)
module.exports = zaloRouter