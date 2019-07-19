/**
 * (c) 2019 cepharum GmbH, Berlin, http://cepharum.de
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2019 cepharum GmbH
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * @author: cepharum
 */

"use strict";

const Event = require( "./event" );


/**
 * Implements pool of events serving as agent between emitting and receiving
 * parties.
 */
class EventPool {
	/** */
	constructor() {
		Object.defineProperties( this, {
			/**
			 * Exposes set of queues separated by recipient ID.
			 *
			 * @name EventPool#queues
			 * @property {object<string,{events:Event[], waitingSoNotify:function=}>}
			 * @readonly
			 * @protected
			 */
			queues: { value: {} },
		} );
	}

	/**
	 * Emits event to be dispatched to recipient selected by its ID.
	 *
	 * @param {string} recipientId select recipient for emitted event
	 * @param {string} eventName name of emitted event
	 * @param {Array} eventArguments customizing arguments of emitted event
	 * @returns {Promise} promises event handled by recipient, the event itself is exposed in property `event` of returned promise
	 */
	emit( recipientId, eventName, ...eventArguments ) {
		if ( !recipientId || typeof recipientId !== "string" ) {
			throw new TypeError( "invalid recipient ID" );
		}

		if ( !this.queues.hasOwnProperty( recipientId ) ) {
			this.queues[recipientId] = {
				active: new Map(),
				pending: [],
			};
		}


		const stub = this.queues[recipientId];
		const event = new Event( eventName, eventArguments );

		stub.pending.push( event );

		if ( stub.waitingSoNotify ) {
			stub.waitingSoNotify();
		}

		return Object.assign( new Promise( ( resolve, reject ) => {
			event.once( "fetched", resolve );
			event.once( "failed", reject );
		} ), { event } );
	}

	/**
	 * Pulls another event for selected recipient from related queue of pending
	 * events.
	 *
	 * @param {string} recipientId ID of recipient
	 * @param {int} timeout timeout in milliseconds to wait for another event to become available
	 * @param {boolean} waitForResolution set true to track pulled
	 * @returns {Promise} promises event pulled from recipient's queue of pending events
	 */
	pull( recipientId, timeout = 30000, waitForResolution = false ) {
		if ( !recipientId || typeof recipientId !== "string" ) {
			throw new TypeError( "invalid recipient ID" );
		}

		if ( !this.queues.hasOwnProperty( recipientId ) ) {
			this.queues[recipientId] = {
				active: new Map(),
				pending: [],
			};
		}


		const stub = this.queues[recipientId];
		const { active, pending } = stub;

		return ( pending.length > 0 ? Promise.resolve() : Promise.race( [
			new Promise( resolve => { stub.waitingSoNotify = resolve; } ),
			new Promise( ( resolve, reject ) => setTimeout( reject, timeout, new Error( "timeout" ) ) ),
		] ) )
			.then( () => {
				stub.waitingSoNotify = null;

				const event = pending.shift();

				if ( waitForResolution ) {
					active[event.id] = event;
				}

				event.emit( "fetched" );

				return event;
			} )
			.catch( error => {
				stub.waitingSoNotify = null;

				throw error;
			} );
	}
}

module.exports = EventPool;
