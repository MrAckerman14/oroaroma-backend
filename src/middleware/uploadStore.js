// import multer from 'multer'
// import { v4 as uuid } from 'uuid'
// import path from 'path'

// const storage = multer.diskStorage({
//   destination: 'uploads/img',
//   filename: (req, file, cb) => {
//     const ext = path.extname(file.originalname)
//     cb(null, uuid() + ext)
//   }
// })

// export default multer({
//   storage,
//   limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
//   fileFilter: (req, file, cb) => {
//     const ok = ['image/jpeg','image/png','image/webp']
//     if (ok.includes(file.mimetype)) cb(null, true)
//     else cb(new Error('Formato no permitido'))
//   }
// })

const multer = require('multer')
const path = require('path')
const { randomUUID } = require('crypto')

const storage = multer.diskStorage({
  destination: 'uploads/img',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, randomUUID() + ext)
  }
})

module.exports = multer({ storage })

