import { EventEmitter } from "node:events"
import { memoryUsage } from "node:process"
export class AsyncJobQue<T = unknown, U = unknown> {
  private promise: Promise<U[]>
  private emitter: EventEmitter
  private tasks: T[]
  private taskLength: number
  private queue: T[] = []
  private intervalId: NodeJS.Timeout
  private taskHandler: (task: T) => Promise<U>
  private results: U[] = []
  constructor({
    tasks,
    taskHandler,
  }: {
    tasks: T[]
    taskHandler: (task: T) => Promise<U>
  }) {
    this.emitter = new EventEmitter()
    this.tasks = tasks
    this.taskLength = tasks.length
    this.taskHandler = taskHandler

    const { promise, resolve } = Promise.withResolvers<U[]>()
    this.promise = promise
    this.emitter.on("finish", () => {
      clearInterval(this.intervalId)
      resolve(this.results)
    })
    this.emitter.on("queue", async () => {
      const task = this.queue.pop()
      if (!task) {
        console.log("task queue not found.")
        return
      }
      await this.runTaskFunction(task)
      this.emitter.emit("deque")
    })
    this.emitter.on("deque", () => {
      const usedInMb = memoryUsage().heapUsed / 1000 / 1024
      if (usedInMb < 1000) {
        // pop
        const task = this.tasks.pop()
        if (!task) {
          if (this.results.length === this.taskLength) {
            this.emitter.emit("finish")
          }
          return
        }
        this.queue.push(task)
        this.emitter.emit("queue")
      }
    })
  }
  private scheduleTasks() {
    this.intervalId = setInterval(() => {
      const usedInMb = memoryUsage().heapUsed / 1000 / 1024
      console.log({ usedInMb })
      if (usedInMb < 1000) {
        const task = this.tasks.pop()
        if (!task) {
          console.log("task finish!")

          if (this.results.length === this.taskLength) {
            this.emitter.emit("finish")
          }
          return
        }
        this.queue.push(task)
        this.emitter.emit("queue")
      }
    }, 500)
  }
  private async runTaskFunction(task: T) {
    const result = await this.taskHandler(task)
    this.results.push(result)
  }
  async run() {
    this.scheduleTasks()
    return await this.promise
  }
}
