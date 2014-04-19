CREATE TABLE pages (
  id serial PRIMARY KEY,

  request_url text NOT NULL,
  request_method text NOT NULL DEFAULT 'GET',
  request_headers json,
  request_body text,

  response_status_code integer,
  response_headers json,
  response_body text,

  failed timestamp with time zone,
  created timestamp with time zone DEFAULT current_timestamp NOT NULL
);

/** Redis structures:

cameo:v01:urls:queue = LIST of urls
cameo:v01:urls:tried = LIST of urls that have been popped off the queue

*/
