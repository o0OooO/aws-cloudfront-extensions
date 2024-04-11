import json
import boto3
import os
import re
import datetime
from datetime import timedelta

dynamodb = boto3.resource('dynamodb')
asg_client = boto3.client('autoscaling')
lambda_client = boto3.client('lambda')
events_client = boto3.client('events')
scheduler_client = boto3.client('scheduler')


lambda_function_name = os.environ.get("LAMBDA_SET_ASG_NAME")
lambda_function_arn = os.environ.get("LAMBDA_SET_ASG_ARN")
scheduler_role_arn = os.environ.get("SCHEDULER_ROLE_ARN")
event_rule_name = os.environ.get("EVENT_RULE_NAME")

APAC_NODE = ['BOM51-C1', 'BOM52-C1', 'ICN51-C1', 'ICN54-C2',
             'NRT51-P2', 'NRT57-P3', 'SIN2-P1', 'SIN52-C2']
AU_NODE = ['SYD1-C1', 'SYD62-P1']
CA_NODE = ['YUL62-C2', 'YUL62-C1']
EU_NODE = ['ARN56-P1', 'ARN54-C1', 'CDG50-P1', 'CDG52-P2', 'DUB2-C1',
           'DUB56-P1', 'FRA56-P4', 'FRA60-P1', 'LHR61-P3', 'LHR50-P2']
JP_NODE = ['NRT51-P2', 'NRT57-P3']
SA_NODE = ['GRU1-C2', 'GRU3-P1']
US_NODE = ['IAD89-P1', 'IAD89-P2', 'SFO5-P2',
           'SFO5-P1', 'DFW56-P1', 'DFW56-P2']
CN_NODE = ['PVG52-E1', 'SZX51-E1', 'BJS9-E1', 'ZHY50-E1']

ALL_POP = list(set(APAC_NODE + AU_NODE + CA_NODE +
               EU_NODE + JP_NODE + SA_NODE + US_NODE + CN_NODE))
pop_map = {
    'all': ALL_POP,
    'apac': APAC_NODE,
    'au': AU_NODE,
    'ca': CA_NODE,
    'eu': EU_NODE,
    'jp': JP_NODE,
    'sa': SA_NODE,
    'us': US_NODE,
    'cn': CN_NODE
}
# REC: regional edge cache
INDIA_REC = ['BOM78-P1', 'BOM78-P4']
JAPAN_REC = ['NRT57-P2', 'NRT57-P3']
OCEANIA_REC = ['SYD1-C1', 'SYD62-P2']
SOUTHEAST_ASIA_REC = ['SIN2-P1', 'SIN2-P2']
SOUTH_KOREA_REC = ['ICN57-P1', 'ICN57-P2']

ALL_REC = list(set(INDIA_REC + JAPAN_REC + OCEANIA_REC +
               SOUTHEAST_ASIA_REC + SOUTH_KOREA_REC))
rec_map = {
    'all': ALL_REC,
    'india': INDIA_REC,
    'japan': JAPAN_REC,
    'new_zealand': OCEANIA_REC,
    'australia': OCEANIA_REC,
    'malaysia': SOUTHEAST_ASIA_REC,
    'china': SOUTHEAST_ASIA_REC,
    'indonesia': SOUTHEAST_ASIA_REC,
    'philippines': SOUTHEAST_ASIA_REC,
    'singapore': SOUTHEAST_ASIA_REC,
    'thailand': SOUTHEAST_ASIA_REC,
    'vietnam': SOUTHEAST_ASIA_REC,
    'south_korea': SOUTH_KOREA_REC
}
ALL = 'all'



def validate_url(url):
    pattern = r"^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$"
    return re.match(pattern, url) is not None


def insert_dynamodb(table_name, item):
    table = dynamodb.Table(table_name)
    table.put_item(
        Item=item
    )


def split_array(arr, chunk_size):
    return [arr[i:i+chunk_size] for i in range(0, len(arr), chunk_size)]


def lambda_handler(event, context):
    body = json.loads(event['body'])
    print(body)

    url_list = list(set(body['url_list']))
    cf_domain = body['cf_domain']
    target_type = body['target_type'] if 'target_type' in body and body['target_type'] else 'pop'
    countries = list(set(body['countries'])) if 'countries' in body and body['countries'] else []
    regions = list(set(body['regions'])) if 'regions' in body and body['regions'] else []
    pops = list(set(body['pops'])) if 'pops' in body and body['pops'] else []
    if target_type == 'region':
        if len(regions) == 0:
            pops = pop_map[ALL]
        else:
            pop_region_opt = []
            for i in regions:
                pop_region_opt.extend(pop_map[i.lower()])
            pops = pop_region_opt
    elif target_type == 'country':
        if len(countries) == 0:
            pops = rec_map[ALL]
        else:
            pop_rec_opt = []
            for i in countries:
                pop_rec_opt.extend(rec_map[i.lower()])
            pops = pop_rec_opt
    elif target_type == 'pop':
        pops = list(set(body['pops'])) if 'pops' in body and body['pops'] else []

    instance_count = body['instance_count']
    timeout = body['timeout']
    header = body['header']
    need_invalidate = body['need_invalidate'] if 'need_invalidate' in body and body['need_invalidate'] else False

    req_id = context.aws_request_id

    invalid_urls = []
    urls = []

    current_time = datetime.datetime.now()
    timeout_time = current_time + datetime.timedelta(minutes=timeout)

    result = {
        'status': 'Success',
        'error_message': '',
        'error_urls': [],
        'request_id': req_id,
        'timestamp': str(current_time),
        'timeout_at': str(timeout_time)
    }

    # 1. Validate URLs
    for url in url_list:
        url = url.strip().replace(" ", "%20").replace("(", "%28").replace(")", "%29")

        if validate_url(url) == False:
            invalid_urls.append(url)
        else:
            urls.append(url)

    if len(invalid_urls) > 0:
        result['status'] = 'Failed'
        result['error_message'] = 'Invalid URLs'
        result['error_urls'] = invalid_urls

        return {
            'statusCode': 400,
            'body': json.dumps(result)
        }

    # 2. Create a EventBridge Scheduler
    timeout_time = current_time + datetime.timedelta(minutes=timeout)
    event_data = {
        'body': json.dumps({
            'DesiredCapacity': 0,
            'req_id': req_id,
            'force_stop': 1
        })
    }

    # 创建 CloudWatch Events 规则
    events_client.put_rule(
        Name=event_rule_name,
        Description=f'schedule to stop {req_id} set asg capacity and pure sqs',
        ScheduleExpression=f'cron({timeout_time.minute} {timeout_time.hour} {timeout_time.day} {timeout_time.month} ? {timeout_time.year})',
        State='ENABLED'
    )

    # 将 Lambda 函数添加为 CloudWatch Events 规则的目标，并传递参数
    events_client.put_targets(
        Rule=event_rule_name,
        Targets=[
            {
                'Id': '1',
                'Arn': lambda_function_arn,
                'Input': json.dumps(event_data)
            }
        ]
    )

    # 3. Write urls to a txt file and upload to s3
    key = '{}/original_urls.txt'.format(req_id)
    with open('/tmp/urls.txt', 'w') as f:
        f.write('\n'.join(urls))
    s3_client = boto3.client('s3')
    s3_client.upload_file('/tmp/urls.txt', os.environ['BUCKET_NAME'], Key=key)

    # 4. Update autoscaling group
    asg_client.update_auto_scaling_group(
        AutoScalingGroupName=os.environ['ASG_NAME'],
        MinSize=instance_count,
        MaxSize=instance_count,
        DesiredCapacity=instance_count
    )

    # 5. Insert dynamodb - request
    req_id = context.aws_request_id
    request_item = {
        'req_id': req_id,
        'cf_domain': cf_domain,
        'pops': pops,
        'instance_count': instance_count,
        'url_count': len(urls),
        'created_at': str(current_time),
        'timeout_at': str(timeout_time),
        'header': header,
        'download_size': 0,
        'download_count': 0,
        'last_update_time': str(current_time),
        'status': 'CREATED',
        'url_path': {
            'bucket': os.environ['BUCKET_NAME'],
            'key': key
        },
        'need_invalidate': need_invalidate
    }
    insert_dynamodb(os.environ['REQUEST_TABLE_NAME'], request_item)

    return {
        'statusCode': 200,
        'body': json.dumps(result)
    }
