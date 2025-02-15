/**
 * @license
 * Copyright 2019 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { expect } from 'chai';
import { SinonStub, stub } from 'sinon';
import '../testing/setup';
import { DataLayer, Gtag } from '@firebase/analytics-types';
import {
  initializeGAId,
  getOrCreateDataLayer,
  insertScriptTag,
  wrapOrCreateGtag,
  findGtagScriptOnPage
} from './helpers';
import { getFakeApp } from '../testing/get-fake-app';
import { GtagCommand } from './constants';
import { Deferred } from '@firebase/util';

const mockAnalyticsId = 'abcd-efgh-ijkl';
const mockFid = 'fid-1234-zyxw';

describe('FirebaseAnalytics methods', () => {
  it('initializeGAId gets FID from installations and calls gtag config with it', async () => {
    const gtagStub: SinonStub = stub();
    const app = getFakeApp(mockAnalyticsId, mockFid);
    await initializeGAId(app, gtagStub);
    expect(gtagStub).to.be.calledWith(GtagCommand.CONFIG, mockAnalyticsId, {
      'firebase_id': mockFid,
      'origin': 'firebase',
      update: true
    });
  });

  it('getOrCreateDataLayer is able to create a new data layer if none exists', () => {
    delete window['dataLayer'];
    expect(getOrCreateDataLayer('dataLayer')).to.deep.equal([]);
  });

  it('getOrCreateDataLayer is able to correctly identify an existing data layer', () => {
    const existingDataLayer = (window['dataLayer'] = []);
    expect(getOrCreateDataLayer('dataLayer')).to.equal(existingDataLayer);
  });

  it('insertScriptIfNeeded inserts script tag', () => {
    expect(findGtagScriptOnPage()).to.be.null;
    insertScriptTag('customDataLayerName');
    const scriptTag = findGtagScriptOnPage();
    expect(scriptTag).to.not.be.null;
    expect(scriptTag!.src).to.contain(`l=customDataLayerName`);
  });

  describe('wrapOrCreateGtag() when user has not previously inserted a gtag script tag on this page', () => {
    afterEach(() => {
      delete window['gtag'];
      delete window['dataLayer'];
    });

    it('wrapOrCreateGtag creates new gtag function if needed', () => {
      expect(window['gtag']).to.not.exist;
      wrapOrCreateGtag({}, 'dataLayer', 'gtag');
      expect(window['gtag']).to.exist;
    });

    it('new window.gtag function waits for all initialization promises before sending group events', async () => {
      const deferred = new Deferred<void>();
      const deferred2 = new Deferred<void>();
      wrapOrCreateGtag(
        { [mockAnalyticsId]: deferred.promise, otherId: deferred2.promise },
        'dataLayer',
        'gtag'
      );
      window['dataLayer'] = [];
      (window['gtag'] as Gtag)(GtagCommand.EVENT, 'purchase', {
        'transaction_id': 'abcd123',
        'send_to': 'some_group'
      });
      await Promise.resolve(); // Clear async event stack but not pending initialization promises.
      expect((window['dataLayer'] as DataLayer).length).to.equal(0);

      deferred.resolve(); // Resolves first initialization promise.
      await Promise.resolve(); // wait for the next cycle
      expect((window['dataLayer'] as DataLayer).length).to.equal(0);

      deferred2.resolve(); // Resolves second initialization promise.
      await Promise.resolve(); // wait for the next cycle

      expect((window['dataLayer'] as DataLayer).length).to.equal(1);
    });

    it(
      'new window.gtag function waits for all initialization promises before sending ' +
        'event with at least one unknown send_to ID',
      async () => {
        const deferred = new Deferred<void>();
        const deferred2 = new Deferred<void>();
        wrapOrCreateGtag(
          { [mockAnalyticsId]: deferred.promise, otherId: deferred2.promise },
          'dataLayer',
          'gtag'
        );
        window['dataLayer'] = [];
        (window['gtag'] as Gtag)(GtagCommand.EVENT, 'purchase', {
          'transaction_id': 'abcd123',
          'send_to': [mockAnalyticsId, 'some_group']
        });
        await Promise.resolve(); // Clear async event stack but not pending initialization promises.
        expect((window['dataLayer'] as DataLayer).length).to.equal(0);

        deferred.resolve(); // Resolves first initialization promise.
        await Promise.resolve(); // wait for the next cycle
        expect((window['dataLayer'] as DataLayer).length).to.equal(0);

        deferred2.resolve(); // Resolves second initialization promise.
        await Promise.resolve(); // wait for the next cycle

        expect((window['dataLayer'] as DataLayer).length).to.equal(1);
      }
    );

    it(
      'new window.gtag function waits for all initialization promises before sending ' +
        'events with no send_to field',
      async () => {
        const deferred = new Deferred<void>();
        const deferred2 = new Deferred<void>();
        wrapOrCreateGtag(
          { [mockAnalyticsId]: deferred.promise, otherId: deferred2.promise },
          'dataLayer',
          'gtag'
        );
        window['dataLayer'] = [];
        (window['gtag'] as Gtag)(GtagCommand.EVENT, 'purchase', {
          'transaction_id': 'abcd123'
        });
        await Promise.resolve(); // Clear async event stack but not pending initialization promises.
        expect((window['dataLayer'] as DataLayer).length).to.equal(0);

        deferred.resolve(); // Resolves first initialization promise.
        await Promise.resolve(); // wait for the next cycle
        expect((window['dataLayer'] as DataLayer).length).to.equal(0);

        deferred2.resolve(); // Resolves second initialization promise.
        await Promise.resolve(); // wait for the next cycle

        expect((window['dataLayer'] as DataLayer).length).to.equal(1);
      }
    );

    it(
      'new window.gtag function only waits for firebase initialization promise ' +
        'before sending event only targeted to Firebase instance GA ID',
      async () => {
        const deferred = new Deferred<void>();
        const deferred2 = new Deferred<void>();
        wrapOrCreateGtag(
          { [mockAnalyticsId]: deferred.promise, otherId: deferred2.promise },
          'dataLayer',
          'gtag'
        );
        window['dataLayer'] = [];
        (window['gtag'] as Gtag)(GtagCommand.EVENT, 'purchase', {
          'transaction_id': 'abcd123',
          'send_to': mockAnalyticsId
        });
        await Promise.resolve(); // Clear async event stack but not pending initialization promises.
        expect((window['dataLayer'] as DataLayer).length).to.equal(0);

        deferred.resolve(); // Resolves first initialization promise.
        await Promise.resolve(); // wait for the next cycle

        expect((window['dataLayer'] as DataLayer).length).to.equal(1);
      }
    );

    it('new window.gtag function does not wait before sending events if there are no pending initialization promises', async () => {
      wrapOrCreateGtag({}, 'dataLayer', 'gtag');
      window['dataLayer'] = [];
      (window['gtag'] as Gtag)(GtagCommand.EVENT, 'purchase', {
        'transaction_id': 'abcd123'
      });
      await Promise.resolve(); // Clear async event stack.
      expect((window['dataLayer'] as DataLayer).length).to.equal(1);
    });

    it('new window.gtag function does not wait when sending "set" calls', async () => {
      wrapOrCreateGtag(
        { [mockAnalyticsId]: Promise.resolve() },
        'dataLayer',
        'gtag'
      );
      window['dataLayer'] = [];
      (window['gtag'] as Gtag)(GtagCommand.SET, { 'language': 'en' });
      expect((window['dataLayer'] as DataLayer).length).to.equal(1);
    });

    it('new window.gtag function waits for initialization promise when sending "config" calls', async () => {
      const deferred = new Deferred<void>();
      wrapOrCreateGtag(
        { [mockAnalyticsId]: deferred.promise },
        'dataLayer',
        'gtag'
      );
      window['dataLayer'] = [];
      (window['gtag'] as Gtag)(GtagCommand.CONFIG, mockAnalyticsId, {
        'language': 'en'
      });
      await Promise.resolve();
      expect((window['dataLayer'] as DataLayer).length).to.equal(0);

      deferred.resolve();
      await Promise.resolve();

      expect((window['dataLayer'] as DataLayer).length).to.equal(1);
    });

    it('new window.gtag function does not wait when sending "config" calls if there are no pending initialization promises', async () => {
      wrapOrCreateGtag({}, 'dataLayer', 'gtag');
      window['dataLayer'] = [];
      (window['gtag'] as Gtag)(GtagCommand.CONFIG, mockAnalyticsId, {
        'transaction_id': 'abcd123'
      });
      await Promise.resolve(); // Clear async event stack.
      expect((window['dataLayer'] as DataLayer).length).to.equal(1);
    });
  });

  describe('wrapOrCreateGtag() when user has previously inserted gtag script tag on this page', () => {
    const existingGtagStub: SinonStub = stub();

    beforeEach(() => {
      window['gtag'] = existingGtagStub;
    });

    afterEach(() => {
      existingGtagStub.reset();
    });

    it('new window.gtag function waits for all initialization promises before sending group events', async () => {
      const deferred = new Deferred<void>();
      const deferred2 = new Deferred<void>();
      wrapOrCreateGtag(
        { [mockAnalyticsId]: deferred.promise, otherId: deferred2.promise },
        'dataLayer',
        'gtag'
      );
      (window['gtag'] as Gtag)(GtagCommand.EVENT, 'purchase', {
        'transaction_id': 'abcd123',
        'send_to': 'some_group'
      });
      await Promise.resolve(); // Clear async event stack but not pending initialization promises.
      expect(existingGtagStub).to.not.be.called;

      deferred.resolve(); // Resolves first initialization promise.
      await Promise.resolve(); // wait for the next cycle
      expect(existingGtagStub).to.not.be.called;

      deferred2.resolve(); // Resolves second initialization promise.
      await Promise.resolve(); // wait for the next cycle

      expect(existingGtagStub).to.be.calledWith(GtagCommand.EVENT, 'purchase', {
        'send_to': 'some_group',
        'transaction_id': 'abcd123'
      });
    });

    it(
      'new window.gtag function waits for all initialization promises before sending ' +
        'event with at least one unknown send_to ID',
      async () => {
        const deferred = new Deferred<void>();
        const deferred2 = new Deferred<void>();
        wrapOrCreateGtag(
          { [mockAnalyticsId]: deferred.promise, otherId: deferred2.promise },
          'dataLayer',
          'gtag'
        );
        (window['gtag'] as Gtag)(GtagCommand.EVENT, 'purchase', {
          'transaction_id': 'abcd123',
          'send_to': [mockAnalyticsId, 'some_group']
        });
        await Promise.resolve(); // Clear async event stack but not pending initialization promises.
        expect(existingGtagStub).to.not.be.called;

        deferred.resolve(); // Resolves first initialization promise.
        await Promise.resolve(); // wait for the next cycle
        expect(existingGtagStub).to.not.be.called;

        deferred2.resolve(); // Resolves second initialization promise.
        await Promise.resolve(); // wait for the next cycle

        expect(existingGtagStub).to.be.calledWith(
          GtagCommand.EVENT,
          'purchase',
          {
            'send_to': [mockAnalyticsId, 'some_group'],
            'transaction_id': 'abcd123'
          }
        );
      }
    );

    it(
      'new window.gtag function waits for all initialization promises before sending ' +
        'events with no send_to field',
      async () => {
        const deferred = new Deferred<void>();
        const deferred2 = new Deferred<void>();
        wrapOrCreateGtag(
          { [mockAnalyticsId]: deferred.promise, otherId: deferred2.promise },
          'dataLayer',
          'gtag'
        );
        (window['gtag'] as Gtag)(GtagCommand.EVENT, 'purchase', {
          'transaction_id': 'abcd123'
        });
        await Promise.resolve(); // Clear async event stack but not pending initialization promises.
        expect(existingGtagStub).to.not.be.called;

        deferred.resolve(); // Resolves first initialization promise.
        await Promise.resolve(); // wait for the next cycle
        expect(existingGtagStub).to.not.be.called;

        deferred2.resolve(); // Resolves second initialization promise.
        await Promise.resolve(); // wait for the next cycle

        expect(existingGtagStub).to.be.calledWith(
          GtagCommand.EVENT,
          'purchase',
          { 'transaction_id': 'abcd123' }
        );
      }
    );

    it(
      'new window.gtag function only waits for firebase initialization promise ' +
        'before sending event only targeted to Firebase instance GA ID',
      async () => {
        const deferred = new Deferred<void>();
        const deferred2 = new Deferred<void>();
        wrapOrCreateGtag(
          { [mockAnalyticsId]: deferred.promise, otherId: deferred2.promise },
          'dataLayer',
          'gtag'
        );
        (window['gtag'] as Gtag)(GtagCommand.EVENT, 'purchase', {
          'transaction_id': 'abcd123',
          'send_to': mockAnalyticsId
        });
        await Promise.resolve(); // Clear async event stack but not pending initialization promises.
        expect(existingGtagStub).to.not.be.called;

        deferred.resolve(); // Resolves first initialization promise.
        await Promise.resolve(); // wait for the next cycle

        expect(existingGtagStub).to.be.calledWith(
          GtagCommand.EVENT,
          'purchase',
          { 'send_to': mockAnalyticsId, 'transaction_id': 'abcd123' }
        );
      }
    );

    it('wrapped window.gtag function does not wait if there are no pending initialization promises', async () => {
      wrapOrCreateGtag({}, 'dataLayer', 'gtag');
      window['dataLayer'] = [];
      (window['gtag'] as Gtag)(GtagCommand.EVENT, 'purchase', {
        'transaction_id': 'abcd321'
      });
      await Promise.resolve(); // Clear async event stack.
      expect(existingGtagStub).to.be.calledWith(GtagCommand.EVENT, 'purchase', {
        'transaction_id': 'abcd321'
      });
    });

    it('wrapped window.gtag function does not wait when sending "set" calls', async () => {
      wrapOrCreateGtag(
        { [mockAnalyticsId]: Promise.resolve() },
        'dataLayer',
        'gtag'
      );
      window['dataLayer'] = [];
      (window['gtag'] as Gtag)(GtagCommand.SET, { 'language': 'en' });
      expect(existingGtagStub).to.be.calledWith(GtagCommand.SET, {
        'language': 'en'
      });
    });

    it('new window.gtag function waits for initialization promise when sending "config" calls', async () => {
      const deferred = new Deferred<void>();
      wrapOrCreateGtag(
        { [mockAnalyticsId]: deferred.promise },
        'dataLayer',
        'gtag'
      );
      window['dataLayer'] = [];
      (window['gtag'] as Gtag)(GtagCommand.CONFIG, mockAnalyticsId, {
        'language': 'en'
      });
      await Promise.resolve();
      expect(existingGtagStub).to.not.be.called;

      deferred.resolve();
      await Promise.resolve();

      expect(existingGtagStub).to.be.calledWith(
        GtagCommand.CONFIG,
        mockAnalyticsId,
        {
          'language': 'en'
        }
      );
    });

    it('new window.gtag function does not wait when sending "config" calls if there are no pending initialization promises', async () => {
      wrapOrCreateGtag({}, 'dataLayer', 'gtag');
      window['dataLayer'] = [];
      (window['gtag'] as Gtag)(GtagCommand.CONFIG, mockAnalyticsId, {
        'transaction_id': 'abcd123'
      });
      await Promise.resolve(); // Clear async event stack.
      expect(existingGtagStub).to.be.calledWith(
        GtagCommand.CONFIG,
        mockAnalyticsId,
        {
          'transaction_id': 'abcd123'
        }
      );
    });
  });
});
