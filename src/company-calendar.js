/**
	A calendar widget by Joshua Claunch
	
	Dependencies: jQuery and Moment.js
*/
(function(outside, $, moment) {
	
	var Header = function(calendar, config) {
		this.calendar = calendar
		this.config = config
		this.init()
	}
	Header.prototype = {
		formatRegex: /format\((.*?)\)/g,
		positions: ['left', 'center', 'right'],
		
		init: function() {
			this.el = $('<header class="cocal-header"></header>')
			this.initPositions()
		},
		
		initPositions: function() {
			for (var i = 0; i < this.positions.length; i++) {
				var position = this.positions[i]
				if (!this.config[position]) continue
				
				var positionEl = this.parseConfig(position, this.config[position])
				
				this.el.append(positionEl)
			}
		},
		
		parseConfig: function(position, items) {
			if (!Array.isArray(items)) throw new TypeError('Company Calendar Error: header item at position "' + position + '" must be an array')
			var container = $('<div class="cocal-header-' + position + '"></div>'),
				date = this.calendar.date
			
			for (var i = 0; i < items.length; i++) {
				var item = items[i],
					pair = item.split('::'),
					html = pair.shift().trim(),
					command = pair.length && pair.shift().trim()
				
				if (this.formatRegex.test(html)) {
					html = html.replace(this.formatRegex, function(match, capture) { return date.format(capture) })
				}
				var tagName = command ? 'a' : 'span',
					el = $('<' + tagName + ' class="cocal-header-item">' + html + '</' + tagName + '>')
				
				if (command) {
					el.on('click', this.calendar.fireCommand.bind(this.calendar, command))
				}
				container.append(el)
			}
			
			return container
		},
		
		update: function() {
			this.el.empty()
			this.initPositions() // TODO: make an intelligent diffing system, instead of just rewriting everything on update
		}
	}
	
	
	var Body = function(calendar, config) {
		if (config.monthStart < 1) config.monthStart = 1
		config.weekStart = Math.max(0, Math.min(6, config.weekStart - 1))
		
		this.calendar = calendar
		this.config = config
		this.init()
	}
	Body.prototype = {
		init: function() {
			this.el = $('<main class="cocal-body"></main>')
			if (!this.config.edgeBorders) this.el.addClass('cocal-sans-edge-borders')
			this.initRows(this.config)
		},
		
		initWeekdayRow: function(config) {
			if (!config.dayNames) return // the user doesn't want these
			
			var row = $('<div class="cocal-daynames"></div>'),
				date = moment().startOf('week')
			
			for (var i = 0; i < 7; date.date(date.date() + 1) && i++) {
				row.append('<div class="cocal-dayname">' + date.format('ddd') + '</div>')
			}
			this.el.append(row)
		},
		
		initRows: function(config) {
			this.initWeekdayRow(this.config)
			var start = this.calendar.date.clone().date(config.monthStart)
			
			if (start.month() !== this.calendar.date.month()) start.month(start.month() - 1).endOf('month')
			if (start.isAfter(this.calendar.date)) start.month(start.month() - 1)
			
			var end = start.clone().month(start.month() + 1)
			end.date(end.date() - 1)
			
			var actualStart = start.clone().day(config.weekStart),
				actualEnd = end.clone().day((config.weekStart + 6) % 7)
			
			if (actualStart.isAfter(start)) actualStart.date(actualStart.date() - 7)
			if (actualEnd.isBefore(end)) actualEnd.date(actualEnd.date() + 7)
			
			while (actualStart.isBefore(actualEnd)) {
				var row = $('<div class="cocal-week"></div>')
				this.initColumns(row, actualStart, start, end, config)
				this.el.append(row)
			}
		},
		
		initColumns: function(row, date, start, end, config) {
			for (var i = 0; i < 7; date.date(date.date() + 1) && i++) {
				if (i === 0 && config.excludeSundays || ~[0, 6].indexOf(i) && config.excludeWeekends) continue
				var col = $('<div class="cocal-day"><span class="cocal-date-number">' + date.format('D') + '</span></div>')
				if (date.isBefore(start) || date.isAfter(end)) col.addClass('cocal-overflow-date')
				
				row.append(col)
			}
		},
		
		update: function() {
			this.el.empty()
			this.initRows(this.config) // TODO: make an intelligent diffing system, instead of just rewriting everything on update
		}
	}
	
	
	var commands = {
		prev: function() {
			this.prev()
		},
		next: function() {
			this.next()
		}
	}
	var defaultConfig = function() {
		return {
			date: moment(),
			dayHeight: '200px',
			dayNames: true,
			edgeBorders: true,
			events: [],
			monthStart: 1,
			weekStart: 1
		}
	}
	
	/**
		Calendar -- The interface the user will actually work with
		Options:
			date -- int|moment [default: now] -- The date that will be selected by default.
			dayHeight -- string [default: '200px'] -- The height of a day in any css unit.
			dayNames -- bool [default: true] -- Whether to display the names of the days of the week (e.g. Sunday, Monday) at the top of the calendar.
			edgeBorders -- bool [default: true] -- Whether the borders on the outside of the calendar should be displayed
			events -- array [optional] -- A list of event objects. Event object properties:
				name -- string [required] -- The name of this event
				start -- int|moment [required] -- The start time of this event
				end -- int|moment [optional] -- The end time of this event
			excludeWeekends -- bool [default: false] -- Set to true if weekends should not be displayed.
			excludeSundays -- bool [default: false] -- Set to true if Sundays should not be displayed.
			header -- object [optional] -- Specify what should be shown in the header of the calendar. 'left', 'center', and 'right' properties may be specified. Each property takes an array like so:
					['Prev::prev', '<i class="fa fa-arrow-right"></i> :: next', 'format(ddd, DD)']
					A double colon separates each string into html/command pairs.
					The command is optional.
					The format() 'function' is a special helper. It will output the moment.js format of the currently selected calendar day. Everything in the `()` will be passed to moment's format() function.
					Custom commands may be supplied via the 'addCommand' method. The native commands are:
				next -- A button that, when clicked, will call the next() function on this calendar object.
				prev -- A button that, when clicked, will call the prev() function on this calendar object.
			monthStart -- int [default: 1] (range: 1-31) -- The day of the month that the month starts on (e.g. to display from Mar 15 to Apr 14, set this to 15). If out of range (e.g. 30 in Feb), will be the last day of the month.
			weeks -- int [optional] -- A fixed number of weeks to display. If not specified, this will vary based on the length of the current month.
			weekStart -- int [default: 1] (range: 1-7) -- The day of the week that a week starts on. 1 = Sunday, and so on.
	*/
	var Calendar = function(config) {
		this.config = $.extend({}, defaultConfig(), config)
		this.date = this.config.date
		if (typeof this.date === 'number') this.date = moment()
		this.date.startOf('day')
		
		this.init()
	}
	Calendar.prototype = {
		init: function() {
			this.el = $('<div class="cocal"></div>')
			this.initHeader(this.config.header)
			this.initBody(this.config)
		},
		
		initBody: function(config) {
			this.body = new Body(this, config)
			this.el.append(this.body.el)
		},
		
		initHeader: function(config) {
			if (!config) return // the header is optional; don't put one in if they didn't specify config for one
			this.header = new Header(this, config)
			this.el.append(this.header.el)
		},
		
		fireCommand: function(command) {
			if (!commands[command]) return
			
			return commands[command].call(this)
		},
		
		next: function() {
			this.date.month(this.date.month() + 1)
			this.update()
		},
		
		prev: function() {
			this.date.month(this.date.month() - 1)
			this.update()
		},
		
		update: function() {
			this.header.update()
			this.body.update()
		}
	}
	
	
	// Expose a factory for easy creation of Calendar objects
	var cocal = outside.cocal = function(config) {
		var calendar = new Calendar(config || {})
		
		if (config.selector) {
			$el = $(selector)
			if (!$el.length) throw new Error('Company Calendar Error: no elements found matching the given selector')
			
			$el.append(calendar.el)
		}
		return calendar
	}
	
	cocal.addCommand = function(command, func) {
		commands[command] = func
	}
})(this, jQuery, moment)
