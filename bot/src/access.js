/**
 * Pagar akses untuk aksi MENULIS (CRUD) di channel struktur.
 *
 * Aturan (16 Nov 2026): hanya pemilik role yang terdaftar (default: BIG HOMIES)
 * atau Administrator/Manage Server. Beda dengan pagar umum bot, daftar
 * ALLOWED_USER_IDS TIDAK berlaku di sini — jadi bukan "siapa pun yang saya
 * percayai", melainkan "siapa pun yang punya role itu".
 *
 * Fungsi ini murni (tanpa import discord.js) supaya bisa diuji langsung dengan node.
 */

/**
 * @param {{ isAdmin?: boolean, isManageGuild?: boolean, roleIds?: string[] }} member
 * @param {string[]} allowedRoleIds
 */
export function canEditStruktur(member, allowedRoleIds) {
  if (!member) return false;
  if (member.isAdmin || member.isManageGuild) return true;
  const roles = member.roleIds ?? [];
  return roles.some((id) => allowedRoleIds.includes(id));
}
