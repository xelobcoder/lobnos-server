const cluster = require('cluster');
const os = require('os');



module.exports = {
  possibleWorkers: os.cpus().length,
  fork: function () {
    for (let i = 0; i < this.possibleWorkers; i++) {
      cluster.fork();
    }
  }
}