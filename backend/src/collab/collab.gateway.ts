import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import { JwtService } from '@nestjs/jwt'
import { UnauthorizedException } from '@nestjs/common'
import { Server, Socket } from 'socket.io'

@WebSocketGateway({
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
})
export class CollabGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(socket: Socket) {
    try {
      const token = socket.handshake.query.token as string
      if (!token) throw new UnauthorizedException('Token manquant')
      const payload = await this.jwt.verifyAsync(token)
      ;(socket as any).user = payload
    } catch {
      socket.emit('error', { message: 'Authentification échouée' })
      socket.disconnect()
    }
  }

  handleDisconnect(socket: Socket) {
    const rooms = [...socket.rooms].filter((r) => r !== socket.id)
    for (const room of rooms) {
      socket.to(room).emit('msg', {
        type: 'leave',
        from: socket.id,
        payload: { id: socket.id },
      })
    }
  }

  @SubscribeMessage('join')
  handleJoin(socket: Socket, payload: { session: string }) {
    if (!payload?.session) return
    socket.join(payload.session)
    const user = (socket as any).user
    socket.to(payload.session).emit('msg', {
      type: 'join',
      from: socket.id,
      payload: { id: socket.id, name: user?.username ?? 'inconnu', color: undefined },
    })
  }

  @SubscribeMessage('msg')
  handleMsg(socket: Socket, data: { type: string; payload: any; from?: string; session?: string }) {
    const room = data.session || [...socket.rooms].find((r) => r !== socket.id)
    if (!room) return
    const msg = {
      type: data.type,
      from: data.from || socket.id,
      payload: data.payload,
    }
    socket.to(room).emit('msg', msg)
  }
}
