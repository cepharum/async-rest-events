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

const DefaultOptions = {
	maxPendingEvents: 100,
	pendingTimeout: Infinity,
	handlingTimeout: Infinity,
};


/**
 * Implements pool of events serving as agent between emitting and receiving
 * parties.
 */
class EventPool {
	/**
	 * @param {object} options customizes created pool's behaviour
	 */
	constructor( options = {} ) {
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

			/**
			 * Exposes options customizing this pool's behaviour.
			 *
			 * @name EventPool#options
			 * @property {object}
			 * @readonly
			 */
			options: { value: Object.assign( {}, DefaultOptions, options || {} ) },
		} );
	}

	/**
	 * Emits event to be dispatched to recipient selected by its ID.
	 *
	 * @param {string} recipientId select recipient for emitted event
	 * @param {string} eventName name of emitted event
	 * @param {Array} eventArguments customizing arguments of emitted event
	 * @param {object} options options customizing particular event's handling
	 * @returns {Promise} promises event handled by recipient, the event itself is exposed in property `event` of returned promise
	 * @protected
	 */
	emitWithOptions( recipientId, eventName, eventArguments, options = {} ) {
		if ( !recipientId || typeof recipientId !== "string" ) {
			return Promise.reject( new TypeError( "invalid recipient ID" ) );
		}

		if ( !this.queues.hasOwnProperty( recipientId ) ) {
			this.queues[recipientId] = {
				active: new Map(),
				pending: [],
			};
		}

		const stub = this.queues[recipientId];

		if ( stub.pending.length >= this.options.maxPendingEvents ) {
			return Promise.reject( Object.assign( new Error( `too many pending events for recipient ${recipientId}` ), { code: "ENOMEM" } ) );
		}

		const event = new Event( eventName, eventArguments, Object.assign( {}, this.options, options || {} ) );

		stub.pending.push( event );

		if ( stub.waitingSoNotify ) {
			stub.waitingSoNotify();
		}

		const resolvingEvent = event.options.waitForHandlers ? "handled" : "pulled";
		let pendingTimer = null, handlingTimer = null;

		// TODO implement resilience tests for assessing probable need for cleaning up resources more thoroughly here
		const promise = new Promise( ( resolve, reject ) => {
			event.once( resolvingEvent, resolve );
			event.once( "failed", reject );


			const { pendingTimeout, handlingTimeout } = event.options;
			const onTimeout = message => {
				reject( Object.assign( new Error( message ), { code: "ETIMEDOUT" } ) );
			};

			if ( pendingTimeout > 0 && pendingTimeout < Infinity ) {
				pendingTimer = setTimeout( onTimeout, pendingTimeout, "pending event timed out" );

				event.once( "pulled", () => clearTimeout( pendingTimer ) );
			}

			if ( resolvingEvent === "handled" && handlingTimeout > 0 && handlingTimeout < Infinity ) {
				event.once( "pulled", () => {
					handlingTimer = setTimeout( onTimeout, handlingTimeout, "event handling timed otu" );
				} );
			}
		} );

		promise // eslint-disable-line promise/catch-or-return
			.catch( () => {} ) // eslint-disable-line no-empty-function
			.then( () => {
				// release some resources as early as possible
				clearTimeout( pendingTimer );
				clearTimeout( handlingTimer );
			} );

		return Object.assign( promise, { event } );
	}

	/**
	 * Emits event to be dispatched to recipient selected by its ID and waits
	 * for the event to be pulled by recipient.
	 *
	 * @param {string} recipientId select recipient for emitted event
	 * @param {string} eventName name of emitted event
	 * @param {Array} eventArguments customizing arguments of emitted event
	 * @returns {Promise} promises event pulled by recipient, the event itself is exposed in property `event` of returned promise
	 */
	emit( recipientId, eventName, ...eventArguments ) {
		return this.emitWithOptions( recipientId, eventName, eventArguments );
	}

	/**
	 * Emits event to be dispatched to recipient selected by its ID and waits
	 * for the event to be pulled _and handled_ by recipient.
	 *
	 * @param {string} recipientId select recipient for emitted event
	 * @param {string} eventName name of emitted event
	 * @param {Array} eventArguments customizing arguments of emitted event
	 * @returns {Promise} promises event handled by recipient, the event itself is exposed in property `event` of returned promise
	 */
	emitAndWait( recipientId, eventName, ...eventArguments ) {
		return this.emitWithOptions( recipientId, eventName, eventArguments, {
			waitForHandlers: true,
		} );
	}

	/**
	 * Pulls another event for selected recipient from related queue of pending
	 * events.
	 *
	 * @param {string} recipientId ID of recipient
	 * @param {int} timeout timeout in milliseconds to wait for another event to become available
	 * @returns {Promise} promises event pulled from recipient's queue of pending events
	 */
	pull( recipientId, timeout = 30000 ) {
		if ( !recipientId || typeof recipientId !== "string" ) {
			return Promise.reject( new TypeError( "invalid recipient ID" ) );
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
			new Promise( resolve => {
				stub.waitingSoNotify = arg => {
					stub.waitingSoNotify = null;
					resolve( arg );
				};
			} ),
			new Promise( ( resolve, reject ) => setTimeout( reject, timeout, Object.assign( new Error( "timeout on waiting for event" ), { timeout: true } ) ) ),
		] ) )
			.then( () => {
				stub.waitingSoNotify = null;

				const event = pending.shift();

				if ( event.waitForHandlers ) {
					active.set( event.id, event );

					event.once( "handled", () => active.delete( event.id ) );
				}

				event.emit( "pulled" );

				return event;
			} )
			.catch( error => {
				stub.waitingSoNotify = null;

				throw error;
			} );
	}
}

module.exports = EventPool;
