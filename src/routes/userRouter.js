const { Router } = require("express");

const userRouter = Router()
userRouter.get('/profile')
userRouter.put('/profile/update')
module.exports = userRouter