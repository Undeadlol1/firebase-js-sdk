import { expect } from 'chai';
import { getRandomNode } from './helpers/util';
import { Database } from '../src/api/Database';
import { Reference } from '../src/api/Reference';

describe('ServerValue tests', () => {
  it('resolves timestamps locally', async () => {
    const node = getRandomNode() as Reference;
    const start = Date.now();
    const values: Array<number> = [];
    node.on('value', snap => {
      expect(typeof snap.val()).to.equal('number');
      values.push(snap.val() as number);
    });
    await node.set(Database.ServerValue.TIMESTAMP);
    node.off('value');

    // By the time the write is acknowledged, we should have a local and
    // server version of the timestamp.
    expect(values.length).to.equal(2);
    values.forEach(serverTime => {
      const delta = Math.abs(serverTime - start);
      expect(delta).to.be.lessThan(1000);
    });
  });

  it('handles increments locally', async () => {
    // Must go offline because the latest emulator may not support this serer op
    const node = getRandomNode() as Reference;
    const addOne = {
      '.sv': {
        'increment': 1
      }
    };

    node.database.goOffline();
    try {
      const values: Array<number> = [];
      node.on('value', snap => {
        console.log('new value', snap.val());
        expect(typeof snap.val()).to.equal('number');
        values.push(snap.val() as number);
      });

      // Because we're offline, we shouldn't await the node operations. This would block the test.
      node.set(addOne);
      node.set(5);
      node.set(addOne);

      node.off('value');
      expect(values).to.deep.equal([1, 5, 6]);
    } finally {
      node.database.goOnline();
    }
  });
});
