import { Injectable, Logger } from '@nestjs/common'

const MAILJET_ENDPOINT = 'https://api.mailjet.com/v3.1/send'

// Échappe les valeurs interpolées dans le HTML de l'email (anti-injection/phishing).
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface EmailDelivery {
  delivered: boolean
  provider: 'mailjet' | 'simulated'
}

// 📧 Envoi d'email via Mailjet (API REST v3.1). Clés en variables d'environnement.
// Si les clés ne sont pas configurées, on RETOMBE en simulation (log) afin que la
// démo et les tests fonctionnent sans compte Mailjet.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private readonly apiKey = process.env.MAILJET_API_KEY
  private readonly secretKey = process.env.MAILJET_SECRET_KEY
  private readonly fromEmail = process.env.MAILJET_FROM_EMAIL
  private readonly fromName = process.env.MAILJET_FROM_NAME ?? 'Plateforme Vidéo'
  // Base publique du front : sert au lien ET aux images (logo) de l'email.
  // ⚠️ En prod, doit être l'URL publique (ex. https://poulpium.midjix-lab.com)
  // pour que le logo soit chargeable par les clients mail.
  private readonly appUrl = process.env.APP_URL ?? 'http://localhost:5173'
  // Mode bac à sable Mailjet : valide l'appel API sans réellement délivrer le mail.
  private readonly sandbox = process.env.MAILJET_SANDBOX === 'true'

  private get configured(): boolean {
    return Boolean(this.apiKey && this.secretKey && this.fromEmail)
  }

  async sendAdminInvite(input: {
    to: string
    companyName: string
    link: string
    tempPassword: string
    expiresAt: number
  }): Promise<EmailDelivery> {
    const subject = `Invitation administrateur — ${input.companyName}`
    const expire = new Date(input.expiresAt).toLocaleString('fr-FR')
    const text =
      `Bonjour,\n\nVous êtes invité comme administrateur de « ${input.companyName} ».\n` +
      `Connectez-vous ici : ${input.link}\n` +
      `Mot de passe temporaire : ${input.tempPassword}\n` +
      `Valable jusqu'au ${expire}. Vous devrez le changer à la première connexion.\n`
    const html = this.buildInviteHtml({
      companyName: escapeHtml(input.companyName),
      link: escapeHtml(input.link),
      tempPassword: escapeHtml(input.tempPassword),
      expire: escapeHtml(expire),
    })

    // Pas de clés → simulation (log + retour à l'appelant via la réponse HTTP).
    if (!this.configured) {
      this.logger.warn(
        `[email simulé] -> ${input.to} | ${subject} | lien=${input.link} | ` +
          `mdp_temporaire=${input.tempPassword} | expire=${expire}`,
      )
      return { delivered: false, provider: 'simulated' }
    }

    try {
      const auth = Buffer.from(`${this.apiKey}:${this.secretKey}`).toString('base64')
      const res = await fetch(MAILJET_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          SandboxMode: this.sandbox,
          Messages: [
            {
              From: { Email: this.fromEmail, Name: this.fromName },
              To: [{ Email: input.to }],
              Subject: subject,
              TextPart: text,
              HTMLPart: html,
            },
          ],
        }),
      })

      if (!res.ok) {
        const body = await res.text()
        this.logger.error(`Mailjet a refusé l'envoi (${res.status}) : ${body}`)
        return { delivered: false, provider: 'mailjet' }
      }
      this.logger.log(
        `Invitation envoyée via Mailjet à ${input.to}${this.sandbox ? ' (sandbox)' : ''}`,
      )
      return { delivered: true, provider: 'mailjet' }
    } catch (error) {
      this.logger.error(`Échec d'envoi Mailjet : ${(error as Error).message}`)
      return { delivered: false, provider: 'mailjet' }
    }
  }

  // Template HTML de l'invitation — charte Poulpium (« Dark Studio »).
  // Compatible clients mail : tables + styles inline, bouton bulletproof, logo PNG
  // hébergé (le SVG serait supprimé par Gmail/Outlook). Les valeurs sont déjà
  // échappées par l'appelant.
  private buildInviteHtml(v: {
    companyName: string
    link: string
    tempPassword: string
    expire: string
  }): string {
    const badge = `${this.appUrl}/poulpium-badge.png`
    const mark = `${this.appUrl}/poulpium-mark.png`
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#05070a;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#101319;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden;">
<tr><td style="background-color:#0e1524;background-image:linear-gradient(135deg,#12204a 0%,#101319 55%);padding:34px 32px 30px 32px;text-align:center;">
<img src="${badge}" width="84" height="84" alt="Poulpium" style="display:inline-block;">
<div style="margin-top:12px;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:.4px;">Poulpium</div>
<div style="margin-top:3px;color:#9aa2ae;font-size:12px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">Plateforme vidéo sécurisée</div>
<div style="margin-top:16px;display:inline-block;padding:5px 12px;border:1px solid rgba(41,197,230,.4);border-radius:999px;color:#29c5e6;font-size:11px;font-weight:700;">🔒 Accès Zero-Trust</div>
</td></tr>
<tr><td style="height:3px;background-image:linear-gradient(100deg,#5b85ff,#3d6dfd 45%,#29c5e6);"></td></tr>
<tr><td style="padding:32px 34px 6px 34px;">
<div style="color:#5b85ff;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1.4px;">Invitation administrateur</div>
<h1 style="margin:12px 0 0 0;color:#e9ebef;font-size:25px;font-weight:800;line-height:1.25;">Vous gérez «&nbsp;${v.companyName}&nbsp;»</h1>
<p style="margin:14px 0 0 0;color:#9aa2ae;font-size:15px;line-height:1.65;">Bonjour,<br>Un super-administrateur vous a désigné <span style="color:#e9ebef;font-weight:700;">administrateur</span> de l'entreprise <span style="color:#e9ebef;font-weight:700;">${v.companyName}</span>. Vous pourrez créer vos utilisateurs et gérer l'accès à vos contenus.</p>
</td></tr>
<tr><td style="padding:26px 34px 4px 34px;" align="center">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="border-radius:12px;background-color:#3d6dfd;background-image:linear-gradient(100deg,#5b85ff,#29c5e6);">
<a href="${v.link}" style="display:inline-block;padding:15px 40px;color:#ffffff;font-size:15px;font-weight:800;text-decoration:none;border-radius:12px;">Activer mon compte&nbsp;&nbsp;→</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:22px 34px 6px 34px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0c0f;border:1px solid rgba(255,255,255,0.09);border-radius:14px;"><tr><td style="padding:18px 20px;">
<div style="color:#5d646f;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;">Mot de passe temporaire</div>
<div style="margin-top:8px;color:#29c5e6;font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:22px;font-weight:700;letter-spacing:2px;">${v.tempPassword}</div>
<div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.07);color:#9aa2ae;font-size:13px;line-height:1.55;">⏳ Valable jusqu'au <span style="color:#f5a623;font-weight:700;">${v.expire}</span> — à changer dès la première connexion.</div>
</td></tr></table>
</td></tr>
<tr><td style="padding:14px 34px 28px 34px;">
<p style="margin:0;color:#5d646f;font-size:12px;line-height:1.6;">Le bouton ne marche pas ? Copiez ce lien :<br><span style="color:#5b85ff;word-break:break-all;">${v.link}</span></p>
</td></tr>
<tr><td style="padding:20px 34px;border-top:1px solid rgba(255,255,255,0.07);background:#0d1016;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="padding-right:8px;"><img src="${mark}" width="20" height="20" alt=""></td><td style="color:#9aa2ae;font-size:12px;font-weight:700;">Poulpium</td></tr></table>
<div style="margin-top:8px;color:#5d646f;font-size:11px;line-height:1.6;">Vous recevez cet email car un administrateur vous a invité. Si vous n'êtes pas concerné, ignorez-le.</div>
</td></tr>
</table>
<div style="height:24px;"></div>
</td></tr></table>`
  }
}
