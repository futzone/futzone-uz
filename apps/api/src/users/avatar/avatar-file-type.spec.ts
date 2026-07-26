import { sniffAvatarImageType } from './avatar-file-type';

describe('sniffAvatarImageType', () => {
  it.each([
    ['jpeg', Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])],
    ['png', Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ['webp', Uint8Array.from([0x52,0x49,0x46,0x46,0,0,0,0,0x57,0x45,0x42,0x50])],
  ] as const)('accepts real %s magic bytes', (type, bytes) => expect(sniffAvatarImageType(bytes)).toBe(type));
  it('rejects a relabeled executable payload', () => {
    const renamedJpeg = new TextEncoder().encode('MZ executable content renamed avatar.jpg');
    expect(sniffAvatarImageType(renamedJpeg)).toBeNull();
  });
});
