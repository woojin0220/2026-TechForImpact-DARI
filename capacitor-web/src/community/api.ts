import type { SupabaseClient } from '@supabase/supabase-js';
import type { BoardId, CommentItem, PostSummary, ReportReason } from './model';
import { normalizeSearch, searchFilter, type FeedOptions } from './discovery.ts';

const feedColumns = 'id,board_id,author_id,title,body,language,status,created_at,comment_count,helpful_count,helped_by_me,author_nickname,author_is_supporter,author_badges';
const commentColumns = 'id,post_id,author_id,body,language,status,created_at,author_nickname,author_is_supporter,author_badges';
export const pageSize = 20;

/** Community data access. Visibility, blocking and write rules are enforced by row-level security. */
export function communityApi(client: SupabaseClient) {
  async function check<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
    const { data, error } = await promise;
    if (error) throw error;
    return data;
  }
  return {
    async listPosts(board: BoardId, before?: string, options: FeedOptions = {}): Promise<PostSummary[]> {
      let query = client.from('post_feed').select(feedColumns).eq('status', 'visible').eq('board_id', board).order('created_at', { ascending: false }).limit(pageSize);
      if (before) query = query.lt('created_at', before);
      if (normalizeSearch(options.search)) query = query.or(searchFilter(options.search!));
      if (options.unanswered && board === 'qna') query = query.eq('comment_count', 0);
      return await check(query) as unknown as PostSummary[];
    },
    async updatePost(authorId:string,id:string,input:{title:string;body:string;language:string}) {
      const row=await check(client.from('posts').update({title:input.title.trim(),body:input.body.trim(),language:input.language}).eq('id',id).eq('author_id',authorId).eq('status','visible').select('id').single());
      return (row as {id:string}).id;
    },
    async listActivity(authorId:string,kind:'posts'|'replies',before?:string):Promise<{posts:(PostSummary & {my_reply?:string;my_reply_language?:string;activity_at?:string})[];next?:string}> {
      if(kind==='posts') {
        let query=client.from('post_feed').select(feedColumns).eq('author_id',authorId).eq('status','visible').order('created_at',{ascending:false}).limit(pageSize);
        if(before)query=query.lt('created_at',before);
        const posts=await check(query) as unknown as PostSummary[];
        return {posts,next:posts.length===pageSize?posts.at(-1)?.created_at:undefined};
      }
      let query=client.from('comment_feed').select(commentColumns).eq('author_id',authorId).eq('status','visible').order('created_at',{ascending:false}).limit(pageSize);
      if(before)query=query.lt('created_at',before);
      const comments=await check(query) as unknown as CommentItem[];
      const ids=[...new Set(comments.map(item=>item.post_id))];
      const parents=ids.length?await check(client.from('post_feed').select(feedColumns).eq('status','visible').in('id',ids)) as unknown as PostSummary[]:[];
      return {posts:comments.flatMap(comment=>{const post=parents.find(item=>item.id===comment.post_id);return post?[{...post,my_reply:comment.body,my_reply_language:comment.language,activity_at:comment.created_at}]:[];}),next:comments.length===pageSize?comments.at(-1)?.created_at:undefined};
    },
    async getPost(id: string): Promise<PostSummary | null> {
      return await check(client.from('post_feed').select(feedColumns).eq('id', id).neq('status', 'deleted').maybeSingle()) as unknown as PostSummary | null;
    },
    async listSavedPosts(ids:string[],options:FeedOptions={}):Promise<PostSummary[]> {
      if(!ids.length)return [];
      let query=client.from('post_feed').select(feedColumns).eq('status','visible').in('id',ids.slice(0,200)).order('created_at',{ascending:false}).limit(200);
      if(normalizeSearch(options.search))query=query.or(searchFilter(options.search!));
      return await check(query) as unknown as PostSummary[];
    },
    async listComments(postId: string): Promise<CommentItem[]> {
      return await check(client.from('comment_feed').select(commentColumns).eq('post_id', postId).eq('status', 'visible').order('created_at', { ascending: true }).limit(200)) as unknown as CommentItem[];
    },
    async createPost(authorId: string, input: { board: BoardId; title: string; body: string; language: string }) {
      const row = await check(client.from('posts').insert({ author_id: authorId, board_id: input.board, title: input.title.trim(), body: input.body.trim(), language: input.language }).select('id').single());
      return (row as { id: string }).id;
    },
    createComment: (authorId: string, postId: string, body: string, language: string) =>
      check(client.from('comments').insert({ author_id: authorId, post_id: postId, body: body.trim(), language })),
    setHelpful: (userId: string, postId: string, on: boolean) => on
      ? check(client.from('post_reactions').insert({ user_id: userId, post_id: postId }))
      : check(client.from('post_reactions').delete().eq('user_id', userId).eq('post_id', postId)),
    report: (reporterId: string, targetType: 'post' | 'comment' | 'user', targetId: string, reason: ReportReason, detail: string) =>
      check(client.from('reports').insert({ reporter_id: reporterId, target_type: targetType, target_id: targetId, reason, detail: detail.trim() || null })),
    block: (blockerId: string, blockedId: string) => check(client.from('blocks').insert({ blocker_id: blockerId, blocked_id: blockedId })),
    deleteOwn: (targetType: 'post' | 'comment', id: string) => check(client.rpc('delete_own_content', { target_type: targetType, target: id })),
  };
}
export type CommunityApi = ReturnType<typeof communityApi>;
