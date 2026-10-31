-- Sub-events of each event type: a Wedding has Haldi, Mehndi, Sangeet, Garba, Wedding Day and Reception. They are
-- suggested as the Event Name of each catering service. Set in Settings, Event types, or by import.
-- Run after 0022. Safe to run again.

alter table public.event_types add column if not exists sub_events text[] not null default '{}';

-- The usual sub-events for event types that have none yet; a caterer's own changes are left alone.
update public.event_types set sub_events = case lower(name)
    when 'wedding' then array['Haldi', 'Mehndi', 'Sangeet', 'Garba', 'Mandap Muhurat', 'Wedding Day', 'Reception']
    when 'engagement' then array['Ring Ceremony', 'Engagement Lunch', 'Engagement Dinner']
    when 'reception' then array['Reception Dinner', 'Cocktail Evening']
    when 'birthday' then array['Cake Cutting', 'Birthday Party', 'Birthday Lunch']
    when 'birthday party' then array['Cake Cutting', 'Birthday Party', 'Birthday Lunch']
    when 'anniversary' then array['Anniversary Dinner', 'Anniversary Party']
    when 'baby shower' then array['Godh Bharai', 'Seemant', 'Baby Shower Lunch']
    when 'housewarming' then array['Vastu Puja', 'Griha Pravesh', 'Housewarming Lunch']
    when 'griha shanti' then array['Griha Shanti Puja', 'Griha Shanti Lunch']
    when 'corporate' then array['Conference Lunch', 'Annual Day', 'Team Dinner', 'Product Launch']
    when 'corporate lunch' then array['Conference Lunch', 'Team Lunch']
    when 'religious' then array['Katha', 'Satsang', 'Bhandara', 'Navratri Garba']
    else sub_events
  end
where sub_events = '{}';
