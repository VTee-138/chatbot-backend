const prisma = require('../config/database');
const { sendEmail } = require('../utils/mailService');
const mail = require('../config/mail');
const config = require('../config');
const crypto = require('crypto');
const AppError = require('../utils/AppError');

/**
 * Create and send invitation email
 */
const createInvitation = async (groupId, inviterUser, inviteeEmail, role = 'MEMBER') => {
  // Check if user already exists in the group
  const existingUser = await prisma.users.findUnique({
    where: { email: inviteeEmail },
    include: {
      group_members: {
        where: { groupId }
      }
    }
  });

  if (existingUser?.group_members.length > 0) {
    throw new AppError('User is already a member of this group', 400);
  }

  // Check for existing pending invitation
  const existingInvitation = await prisma.invitations.findFirst({
    where: {
      email: inviteeEmail,
      groupId,
      status: 'PENDING'
    }
  });

  if (existingInvitation) {
    throw new AppError('An invitation is already pending for this email', 400);
  }

  // Generate unique token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

  // Create invitation
  const invitation = await prisma.invitations.create({
    data: {
      id: crypto.randomUUID(),
      email: inviteeEmail,
      role,
      token,
      status: 'PENDING',
      expiresAt,
      groupId,
      invitedById: inviterUser.id,
      createdAt: new Date()
    },
    include: {
      groups: true,
      users: true
    }
  });

  // Send invitation email
  await sendInvitationEmail(invitation, inviterUser);

  return invitation;
};

/**
 * Send invitation email to user
 */
const sendInvitationEmail = async (invitation, inviter) => {
  const inviteLink = `${config.FRONTEND_URL || 'http://localhost:3000'}/invitations/accept/${invitation.token}`;
  
  const subject = `🎉 You've been invited to join ${invitation.groups.name}!`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .container {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 10px;
          padding: 40px;
          color: white;
        }
        .content {
          background: white;
          color: #333;
          border-radius: 8px;
          padding: 30px;
          margin-top: 20px;
        }
        .button {
          display: inline-block;
          padding: 12px 30px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-decoration: none;
          border-radius: 5px;
          margin: 20px 0;
          font-weight: bold;
        }
        .footer {
          text-align: center;
          color: #888;
          font-size: 12px;
          margin-top: 20px;
        }
        .info-box {
          background: #f8f9fa;
          border-left: 4px solid #667eea;
          padding: 15px;
          margin: 15px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎉 Group Invitation</h1>
        <p>You've been invited to collaborate!</p>
      </div>
      
      <div class="content">
        <h2>Hello!</h2>
        <p><strong>${inviter.userName || inviter.email}</strong> has invited you to join <strong>${invitation.groups.name}</strong>.</p>
        
        <div class="info-box">
          <p><strong>📋 Group:</strong> ${invitation.groups.name}</p>
          <p><strong>👤 Invited by:</strong> ${inviter.userName || inviter.email}</p>
          <p><strong>🎭 Your role:</strong> ${invitation.role}</p>
          <p><strong>⏰ Expires:</strong> ${new Date(invitation.expiresAt).toLocaleDateString()}</p>
        </div>
        
        <p>Click the button below to accept the invitation:</p>
        
        <center>
          <a href="${inviteLink}" class="button">Accept Invitation</a>
        </center>
        
        <p style="color: #666; font-size: 14px;">
          Or copy and paste this link into your browser:<br>
          <code>${inviteLink}</code>
        </p>
        
        <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          This invitation will expire in 7 days. If you don't want to join, you can safely ignore this email.
        </p>
      </div>
      
      <div class="footer">
        <p>© ${new Date().getFullYear()} Your Company. All rights reserved.</p>
        <p>This is an automated email, please do not reply.</p>
      </div>
    </body>
    </html>
  `;

  try {
    await sendEmail(mail, invitation.email, subject, inviteLink, htmlContent, 3);
    console.log('✅ Invitation email sent to:', invitation.email);
  } catch (error) {
    console.error('❌ Failed to send invitation email:', error);
    // Don't throw error - invitation is created, just email failed
    // Owner can resend later
  }
};

/**
 * Send join request email to group owner
 */
const sendJoinRequestEmail = async (group, requesterUser) => {
  const owner = await prisma.users.findUnique({
    where: { id: group.creatorId }
  });

  if (!owner || !owner.email) {
    throw new AppError('Group owner email not found', 500);
  }

  const subject = `📬 ${requesterUser.userName || requesterUser.email} wants to join ${group.name}`;
  
  const approveLink = `${config.FRONTEND_URL || 'http://localhost:3000'}/groups/${group.id}/requests`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .container {
          background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
          border-radius: 10px;
          padding: 40px;
          color: white;
        }
        .content {
          background: white;
          color: #333;
          border-radius: 8px;
          padding: 30px;
          margin-top: 20px;
        }
        .button {
          display: inline-block;
          padding: 12px 30px;
          background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
          color: white;
          text-decoration: none;
          border-radius: 5px;
          margin: 20px 0;
          font-weight: bold;
        }
        .user-info {
          background: #f8f9fa;
          border-left: 4px solid #11998e;
          padding: 15px;
          margin: 15px 0;
        }
        .footer {
          text-align: center;
          color: #888;
          font-size: 12px;
          margin-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>📬 New Join Request</h1>
        <p>Someone wants to join your group!</p>
      </div>
      
      <div class="content">
        <h2>Hello, ${owner.userName || 'Group Owner'}!</h2>
        <p>You have a new request to join your group <strong>${group.name}</strong>.</p>
        
        <div class="user-info">
          <p><strong>👤 User:</strong> ${requesterUser.userName || 'New User'}</p>
          <p><strong>📧 Email:</strong> ${requesterUser.email}</p>
          <p><strong>📅 Requested:</strong> ${new Date().toLocaleDateString()}</p>
        </div>
        
        <p>Please review this request and decide whether to accept or reject it:</p>
        
        <center>
          <a href="${approveLink}" class="button">Review Request</a>
        </center>
        
        <p style="color: #666; font-size: 14px;">
          Or go to your group dashboard to manage requests.
        </p>
      </div>
      
      <div class="footer">
        <p>© ${new Date().getFullYear()} Your Company. All rights reserved.</p>
        <p>This is an automated email, please do not reply.</p>
      </div>
    </body>
    </html>
  `;

  try {
    await sendEmail(mail, owner.email, subject, approveLink, htmlContent, 3);
    console.log('✅ Join request email sent to owner:', owner.email);
  } catch (error) {
    console.error('❌ Failed to send join request email:', error);
    // Don't throw - request is still created
  }
};

/**
 * Resend invitation email
 */
const resendInvitation = async (invitationId, inviterUser) => {
  const invitation = await prisma.invitations.findUnique({
    where: { id: invitationId },
    include: {
      groups: true,
      users: true
    }
  });

  if (!invitation) {
    throw new AppError('Invitation not found', 404);
  }

  if (invitation.status !== 'PENDING') {
    throw new AppError('Can only resend pending invitations', 400);
  }

  // Check if expired, update expiry
  if (new Date() > new Date(invitation.expiresAt)) {
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);
    
    await prisma.invitations.update({
      where: { id: invitationId },
      data: { expiresAt: newExpiresAt }
    });
    
    invitation.expiresAt = newExpiresAt;
  }

  await sendInvitationEmail(invitation, inviterUser);

  return invitation;
};

module.exports = {
  createInvitation,
  sendInvitationEmail,
  sendJoinRequestEmail,
  resendInvitation
};
