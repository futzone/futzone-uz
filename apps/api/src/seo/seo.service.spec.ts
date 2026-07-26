import { SeoService } from './seo.service';

type MatchFixture = {
  slug: string;
  status: 'DRAFT' | 'PUBLISHED' | 'FULL' | 'STARTED';
  joinMode: 'AUTO' | 'INVITE_ONLY';
  deletedAt: Date | null;
  createdAt: Date;
};

type MatchFindManyQuery = {
  where: {
    deletedAt: null;
    status: { in: MatchFixture['status'][] };
    joinMode: { not: MatchFixture['joinMode'] };
  };
};

describe('SeoService', () => {
  it('queries only indexable public matches and emits no private fields', async () => {
    const createdAt = new Date('2026-07-23T00:00:00Z');
    const fixtures: MatchFixture[] = [
      { slug: 'phase2-five-evening', status: 'PUBLISHED', joinMode: 'AUTO', deletedAt: null, createdAt },
      { slug: 'phase2-five-full', status: 'FULL', joinMode: 'AUTO', deletedAt: null, createdAt },
      { slug: 'phase2-eight-invite', status: 'PUBLISHED', joinMode: 'INVITE_ONLY', deletedAt: null, createdAt },
      { slug: 'phase2-six-draft', status: 'DRAFT', joinMode: 'AUTO', deletedAt: null, createdAt },
      { slug: 'phase2-seven-started', status: 'STARTED', joinMode: 'AUTO', deletedAt: null, createdAt },
    ];
    const prisma = {
      city: { findMany: jest.fn().mockResolvedValue([]) },
      stadium: { findMany: jest.fn().mockResolvedValue([]) },
      match: {
        findMany: jest.fn(async (query: MatchFindManyQuery) => fixtures.filter((fixture) =>
          fixture.deletedAt === query.where.deletedAt
          && query.where.status.in.includes(fixture.status)
          && fixture.joinMode !== query.where.joinMode.not,
        )),
      },
      user: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const manifest = await new SeoService(prisma as never).manifest();
    expect(prisma.match.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        deletedAt: null,
        status: { in: ['PUBLISHED', 'FULL'] },
        joinMode: { not: 'INVITE_ONLY' },
      },
    }));
    const serialized = JSON.stringify(manifest);
    expect(manifest.matches.map(({ slug }) => slug)).toEqual(['phase2-five-evening', 'phase2-five-full']);
    expect(serialized).not.toContain('phase2-eight-invite');
    expect(serialized).not.toMatch(/phone|token|owner|participant/i);
  });
});
