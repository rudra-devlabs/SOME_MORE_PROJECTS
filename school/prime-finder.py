num = int(input("Enter a number: "))
msg = "A prime number!"
for i in range(2,num):
    if (num%i == 0):
        msg = "Not a prime number!"
print(msg)