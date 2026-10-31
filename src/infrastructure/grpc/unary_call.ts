import { type DescMessage, type DescMethodUnary, fromBinary, type MessageShape, toBinary } from "@bufbuild/protobuf"
import { type Client, Metadata, type ServiceError } from "@grpc/grpc-js"

function unaryCall<I extends DescMessage, O extends DescMessage>(
  client: Client,
  method: DescMethodUnary<I, O>,
  request: MessageShape<I>,
  timeoutSeconds: number
): Promise<MessageShape<O>> {
  return new Promise((resolve, reject) => {
    client.makeUnaryRequest(
      `/${method.parent.typeName}/${method.name}`,
      (message: MessageShape<I>) => Buffer.from(toBinary(method.input, message)),
      (bytes: Buffer) => fromBinary(method.output, bytes),
      request,
      new Metadata(),
      { deadline: new Date(Date.now() + timeoutSeconds * 1000) },
      (error: ServiceError | null, response?: MessageShape<O>) => {
        if (error !== null || response === undefined) {
          reject(error ?? new Error(`${method.name} answered nothing`))

          return
        }

        resolve(response)
      }
    )
  })
}

export { unaryCall }
