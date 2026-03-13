const { createServer } = require('node:http')

const server = createServer((req, res) => {
    res.end("Hello World")
})

server.listen(5000, () => {console.log('Server is running')});
