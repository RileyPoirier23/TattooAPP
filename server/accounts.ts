// Permanently deleting an account, together with the uploaded files that only it used.
import { getDb, parseJson } from './db';
import type { UserRow } from './auth';
import { disableCard } from './square';
import { deleteUpload } from './uploads';
import type { PortfolioImage } from '../shared/types';

/**
 * Deletes the account; the database removes its profile, shop, conversations, reviews and the requests sent to
 * them as an artist. Their photos and attachments are removed from disk too. Callers check deletionBlockers first.
 */
export async function deleteAccount(user: UserRow) {
  const db = getDb();
  const urls = (sql: string) => (db.prepare(sql).all({ u: user.id }) as { url: string | null }[]).map(r => r.url);
  const files = [
    user.avatar_url,
    ...parseJson<PortfolioImage[]>(user.portfolio, []).map(p => p.url),
    ...urls('select image_url url from shops where owner_id = @u'),
    // Whole conversations go, including the other person's messages and photos.
    ...urls(
      `select m.attachment_url url from messages m join conversations c on c.id = m.conversation_id
       where (c.user_a = @u or c.user_b = @u) and m.attachment_url is not null`,
    ),
    // Requests sent to this artist go too, with the reference photos clients attached.
    ...urls('select reference_images url from booking_requests where artist_id = @u').flatMap(r => parseJson<string[]>(r, [])),
  ];
  if (user.square_card_id) await disableCard(user.square_card_id);
  db.prepare('delete from users where id = ?').run(user.id);
  files.forEach(deleteUpload);
}
