module.exports = {
    apps: [{
      name: "api",
      script: "./server.js",
      "instances" : "max",
      "exec_mode" : "cluster",
      "node_args" : "--max-old-space-size=30000"
    },{
      name: "cron",
      script: "./server_cron.js",
      "exec_mode" : "fork",
      "node_args" : "--max-old-space-size=30000" 
    },{
      name: "socket",
      script: "./server_socket.js",
      "exec_mode" : "fork",
      "node_args" : "--max-old-space-size=30000"
    }]
  }