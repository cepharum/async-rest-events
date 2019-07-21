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

const { describe, before, it } = require( "mocha" );
require( "should" );

const { EventPool } = require( "../" );


describe( "Dispatching events", () => {
	let pool = null;

	before( () => {
		pool = new EventPool( {
			pendingTimeout: 900,
			handlingTimeout: 900,
		} );
	} );

	it( "optionally times out emitting events due to pool-option", () => {
		const start = Date.now();

		return pool.emit( "nonPullingRecipient", "someName" )
			.should.be.Promise().which.is.rejected()
			.then( () => {
				( Date.now() - start ).should.be.greaterThanOrEqual( 750 ).and.lessThanOrEqual( 1050 );
			} );
	} );

	it( "optionally times out emitting events due to emitter-option", () => {
		const start = Date.now();

		return pool.emitWithOptions( "nonPullingRecipient", "someName", [], {
			pendingTimeout: 500,
		} )
			.should.be.Promise().which.is.rejected()
			.then( () => {
				( Date.now() - start ).should.be.greaterThanOrEqual( 350 ).and.lessThanOrEqual( 650 );
			} );
	} );

	it( "optionally times out emitting events waiting for event being handled due to emitter-option", () => {
		const start = Date.now();

		setTimeout( () => pool.pull( "pullingRecipient" ), 400 );

		return pool.emitAndWait( "pullingRecipient", "someName" )
			.should.be.Promise().which.is.rejected()
			.then( () => {
				( Date.now() - start ).should.be.greaterThanOrEqual( 1150 ).and.lessThanOrEqual( 1450 );
			} );
	} );

	it( "optionally times out emitting events waiting for event being handled due to emitter-option", () => {
		const start = Date.now();

		setTimeout( () => pool.pull( "pullingRecipient" ), 400 );

		return pool.emitWithOptions( "pullingRecipient", "someName", [], {
			waitForHandlers: true,
			pendingTimeout: 500,
			handlingTimeout: 500,
		} )
			.should.be.Promise().which.is.rejected()
			.then( () => {
				( Date.now() - start ).should.be.greaterThanOrEqual( 750 ).and.lessThanOrEqual( 1050 );
			} );
	} );

	it( "times out pulling events", () => {
		const start = Date.now();

		return pool.pull( "disobeyedRecipient", 500 )
			.should.be.Promise().which.is.rejected()
			.then( () => {
				( Date.now() - start ).should.be.greaterThanOrEqual( 300 ).and.lessThanOrEqual( 700 );
			} );
	} );
} );
