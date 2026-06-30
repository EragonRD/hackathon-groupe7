import { JwtService } from '@nestjs/jwt'
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets'
import { Socket } from 'socket.io'

// ============================================================================
//  ReviewGateway — relais temps réel des sessions de revue (Pôle 1).
// ----------------------------------------------------------------------------
//  Volontairement DUMB : le serveur ne fait que relayer les messages aux autres
//  membres de la room `session` (jamais à l'émetteur). Il n'interprète PAS le
//  contenu : les notes, curseurs, présence ET le « Watch Together » (messages
//  `wt:*`) transitent tous par le même canal `msg`. Toute la logique métier vit
//  côté client (`frontend/src/lib/collab.js` + `useReview.js`).
//
//  Pourquoi un relais et pas un store serveur : l'UI gère déjà la resync entre
//  pairs (réponse à `join`) et l'anti-écho (chaque message porte `from`, on
//  ignore les siens). Le relais suffit donc pour passer de la démo mono-machine
//  (BroadcastChannel) au LAN 2-3 machines, sans changer une ligne d'UI.
//
//  CORS : le décorateur configure le serveur socket.io (distinct du
//  `app.enableCors()` d'Express, qui ne couvre PAS socket.io).
// ============================================================================

const room = (session: string) => `review:${session}`

interface RelayMessage {
  type?: string
  from?: string
  session?: string
  payload?: unknown
}

@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class ReviewGateway implements OnGatewayConnection {
  constructor(private readonly jwt: JwtService) {}

  // Identité best-effort : si un JWT valide accompagne le handshake, on l'attache
  // au socket (utile pour le Bloc B / journalisation). P1 = identité, pas
  // contrôle d'accès : une connexion sans token reste acceptée (l'identité est
  // de toute façon portée par les messages). Le durcissement « refus par
  // défaut » est l'objet du Pôle 2, pas d'ici.
  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth?.token as string | undefined
    if (!token) return
    try {
      client.data.user = await this.jwt.verifyAsync(token)
    } catch {
      // token invalide/expiré : on n'interrompt pas la collaboration de revue.
    }
  }

  // Le client rejoint la room de sa session (et la re-rejoint après reconnexion).
  @SubscribeMessage('join')
  onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { session?: string },
  ): void {
    if (body?.session) client.join(room(body.session))
  }

  // Relai pur : renvoie le message à tous les autres membres de la room.
  // `client.to(room)` exclut l'émetteur -> pas de boucle d'écho côté serveur.
  @SubscribeMessage('msg')
  onMsg(@ConnectedSocket() client: Socket, @MessageBody() data: RelayMessage): void {
    if (!data?.session) return
    client.to(room(data.session)).emit('msg', data)
  }
}
