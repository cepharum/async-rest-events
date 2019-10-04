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


describe( "Instantly notifying pending listeners on new events", () => {
	let pool = null;

	before( () => {
		pool = new EventPool();
	} );

	it( "works with multiple listeners waiting for the same recipient", () => {
		let event1, event2;

		const pull1 = new Promise( resolve => setTimeout( resolve, 100 ) )
			.then( () => pool.pull( "all" ).then( event => { event1 = event; } ) );

		const pull2 = new Promise( resolve => setTimeout( resolve, 200 ) )
			.then( () => pool.pull( "all" ).then( event => { event2 = event; } ) );

		setTimeout( () => pool.emit( "all", "first emitted" ), 400 );
		setTimeout( () => pool.emit( "all", "second emitted" ), 800 );

		return Promise.race( [
			new Promise( ( _, reject ) => setTimeout( reject, 1000, new Error( "request(s) timed out" ) ) ),
			Promise.all( [ pull1, pull2 ] ),
		] )
			.then( () => {
				event1.name.should.be.equal( "first emitted" );
				event2.name.should.be.equal( "second emitted" );
			} );
	} );
} );
