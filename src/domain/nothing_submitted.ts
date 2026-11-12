class NothingSubmitted extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = "NothingSubmitted"
  }
}

export default NothingSubmitted
