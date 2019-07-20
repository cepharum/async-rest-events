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

const { Event, EventPool } = require( "../" );


describe( "Dispatching events", () => {
	let pool = null;

	before( () => {
		pool = new EventPool();
	} );

	it( "delays event emitter until emitted event has been pulled", function() {
		this.timeout( 10000 );

		setTimeout( () => pool.pull( "myId" ), 1000 );

		const start = Date.now();

		return pool.emit( "myId", "test" )
			.then( () => {
				( Date.now() - start ).should.be.greaterThanOrEqual( 800 ).and.lessThanOrEqual( 1200 );
			} );
	} );

	it( "delays event pulling until there is an event emitted", function() {
		this.timeout( 10000 );

		setTimeout( () => pool.emit( "myId", "test" ), 1000 );

		const start = Date.now();

		return pool.pull( "myId" )
			.then( () => {
				( Date.now() - start ).should.be.greaterThanOrEqual( 800 ).and.lessThanOrEqual( 1200 );
			} );
	} );

	it( "pulls event matching recipient, only", function() {
		this.timeout( 10000 );

		setTimeout( () => pool.emit( "wrongId", "test" ), 1000 );
		setTimeout( () => pool.emit( "properId", "test" ), 3000 );

		const start = Date.now();

		return pool.pull( "properId" )
			.then( () => {
				( Date.now() - start ).should.be.greaterThanOrEqual( 2800 ).and.lessThanOrEqual( 3200 );
			} );
	} );

	it( "times out pulling events", function() {
		this.timeout( 10000 );

		return pool.pull( "properId", 1000 )
			.should.be.Promise().which.is.rejected();
	} );

	it( "pulls full description of emitted event", function() {
		this.timeout( 10000 );

		setTimeout( () => pool.emit( "myId", "test", 1, "second" ), 100 );

		return pool.pull( "myId" )
			.then( event => {
				event.should.be.instanceOf( Event );
				event.name.should.be.String().which.is.equal( "test" );
				event.arguments.should.be.Array().which.is.deepEqual( [ 1, "second" ] );
			} );
	} );
} );
