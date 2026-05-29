from openai import OpenAI

client = OpenAI()
response = client.responses.create(
    input="Write a haiku.",
    model="gpt-4o")

print(response.output_text)