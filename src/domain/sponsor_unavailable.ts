class SponsorUnavailable extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = "SponsorUnavailable"
  }
}

export default SponsorUnavailable
