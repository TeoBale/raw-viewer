export class TaskQueue {
  private readonly concurrency: number
  private active = 0
  private readonly jobs: Array<() => void> = []

  constructor(concurrency: number) {
    this.concurrency = Math.max(1, concurrency)
  }

  async enqueue<T>(job: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = (): void => {
        this.active += 1
        void job()
          .then((value) => {
            resolve(value)
          })
          .catch((error: unknown) => {
            reject(error)
          })
          .finally(() => {
            this.active -= 1
            this.drain()
          })
      }

      if (this.active < this.concurrency) {
        run()
      } else {
        this.jobs.push(run)
      }
    })
  }

  private drain(): void {
    while (this.active < this.concurrency && this.jobs.length > 0) {
      const next = this.jobs.shift()
      if (next) {
        next()
      }
    }
  }
}
